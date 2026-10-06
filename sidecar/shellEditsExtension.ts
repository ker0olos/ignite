/**
 * What a bash command changed in the folder's files (a script, `sed -i`, a
 * formatter), kept on its result as diffs the conversation shows like edits.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { randomUUID } from "node:crypto";
import { access, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { APP_NAME } from "../src/lib/app.ts";
import type { ShellEdit } from "../shared/shellEdits.ts";
import { git, workingTree } from "./worktreeGit.ts";

// Kept on the session file with the result, so a mass rewrite can't bloat it.
const MAX_DIFF_CHARS = 200_000;

const DIFF = ["--no-color", "--no-renames", "--no-ext-diff", "--no-textconv"];

// A file that changed type (a symlink now a regular file) gets two blocks
// under one header: a deletion and an addition.
function blocksByFile(text: string) {
  const blocks: string[] = [];
  let header = "";
  for (const block of text.split(/^diff --git /m).slice(1)) {
    const first = block.slice(0, block.indexOf("\n"));
    if (first === header) blocks[blocks.length - 1] += block;
    else blocks.push(block);
    header = first;
  }
  return blocks;
}

/** The files that differ between two trees of `dir`'s repository, with their diffs. */
export async function changedFiles(
  dir: string,
  before: string,
  after: string,
): Promise<ShellEdit[]> {
  if (before === after) return [];
  const [names, text] = await Promise.all([
    git(dir, ["diff", "--name-only", "-z", ...DIFF, before, after]),
    git(dir, ["diff", "-U3", ...DIFF, before, after]),
  ]);
  const diffs = blocksByFile(text);
  return names
    .split("\0")
    .filter(Boolean)
    .map((path, i) => ({ path, diff: diffs[i] ?? "" }));
}

function capped(edits: ShellEdit[]): ShellEdit[] {
  let budget = MAX_DIFF_CHARS;
  return edits.map((e) => {
    budget -= e.diff.length;
    return budget >= 0 ? e : { ...e, diff: "" };
  });
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// What may sit either side of a path segment: separators (`/`, Windows' `\`), quotes, shell syntax.
const BEFORE = String.raw`(?:^|[\s'"${"`"}=:/\\({,<>;|&@\[!*])`;
const AFTER = String.raw`(?:$|[\s'"${"`"}/\\)},<>;|&:=*\]$])`;

/** Whether `command` names the folder `name` as a path segment anywhere, heredocs and quoted script text included. */
export function namesFolder(
  command: string,
  name: string,
  // As the file system does: macOS and Windows ignore case, Linux doesn't.
  ignoreCase = process.platform !== "linux",
): boolean {
  // A space may be written escaped (`my\ app`).
  const spelled = escape(name).replaceAll(" ", String.raw`(?: |\\ )`);
  const flags = ignoreCase ? "i" : "";
  return new RegExp(`${BEFORE}${spelled}${AFTER}`, flags).test(command);
}

// ponytail: outside git, only repositories one level down that the command names are compared; a script that edits one unnamed is missed.
/** The repositories one level down `cwd` (a folder outside git holding several) whose folder `command` names; symlinked ones too. */
async function namedRepos(cwd: string, command: string): Promise<string[]> {
  const names = await readdir(cwd).catch(() => []);
  const found = await Promise.all(
    names
      .filter((name) => namesFolder(command, name))
      .map((name) => join(cwd, name))
      .map((dir) =>
        access(join(dir, ".git")).then(
          () => dir,
          () => null,
        ),
      ),
  );
  return found.filter((dir): dir is string => !!dir);
}

// ponytail: the whole working tree is compared, so another call running at the same time (a parallel bash, a background watcher) has its changes shown here too.
export default function shellEdits(pi: ExtensionAPI) {
  // One index per repository: its stat cache spares rehashing unchanged files, untracked ones too.
  const indexes = new Map<string, { file: string; queue: Promise<unknown> }>();
  const tree = (repo: string) => {
    let index = indexes.get(repo);
    if (!index) {
      const file = join(tmpdir(), `${APP_NAME}-shell-index-${randomUUID()}`);
      indexes.set(repo, (index = { file, queue: Promise.resolve() }));
    }
    // Taken one at a time, since they share the index (and its lock).
    const next = index.queue.then(() => workingTree(repo, index.file));
    index.queue = next.catch(() => {});
    return next.catch(() => null);
  };
  const trees = async (cwd: string, command: string) => {
    const own = await tree(cwd);
    if (own) return [{ repo: cwd, at: own as string | null }];
    const repos = await namedRepos(cwd, command);
    return Promise.all(
      repos.map(async (repo) => ({ repo, at: await tree(repo) })),
    );
  };
  // Tool call id → each repository's working tree when it started; null where it couldn't be read.
  const before = new Map<string, ReturnType<typeof trees>>();

  pi.on("tool_call", async (event, ctx) => {
    const { command, background } = event.input as {
      command?: unknown;
      background?: unknown;
    };
    if (event.toolName !== "bash" || background) return;
    const start = trees(ctx.cwd, String(command ?? ""));
    before.set(event.toolCallId, start);
    await start;
  });

  pi.on("tool_result", async (event, ctx) => {
    const starts = (await before.get(event.toolCallId)) ?? [];
    before.delete(event.toolCallId);
    const changed = await Promise.all(
      starts.map(async ({ repo, at }) => {
        const end = at && (await tree(repo));
        if (!at || !end) return [];
        const prefix = relative(ctx.cwd, repo).replaceAll("\\", "/");
        const edits = await changedFiles(repo, at, end).catch(() => []);
        return edits.map((e) =>
          prefix ? { ...e, path: `${prefix}/${e.path}` } : e,
        );
      }),
    );
    const edits = capped(changed.flat());
    if (!edits.length) return;
    return { details: { ...(event.details as object), edits } };
  });

  pi.on("session_shutdown", async () => {
    await Promise.all(
      [...indexes.values()].map((i) => rm(i.file, { force: true })),
    );
  });
}
