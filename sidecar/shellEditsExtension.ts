/**
 * What a bash command changed in the folder's files (a script, `sed -i`, a
 * formatter), kept on its result as diffs the conversation shows like edits.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  let budget = MAX_DIFF_CHARS;
  return names
    .split("\0")
    .filter(Boolean)
    .map((path, i) => {
      const diff = diffs[i] ?? "";
      budget -= diff.length;
      return { path, diff: budget >= 0 ? diff : "" };
    });
}

// ponytail: the whole working tree is compared, so another call running at the same time (a parallel bash, a background watcher) has its changes shown here too.
export default function shellEdits(pi: ExtensionAPI) {
  // One index for the conversation: its stat cache spares rehashing unchanged files, untracked ones too.
  const indexFile = join(tmpdir(), `${APP_NAME}-shell-index-${randomUUID()}`);
  // Taken one at a time, since they share the index (and its lock).
  let queue: Promise<unknown> = Promise.resolve();
  const tree = (cwd: string) => {
    const next = queue.then(() => workingTree(cwd, indexFile));
    queue = next.catch(() => {});
    return next.catch(() => null);
  };
  // Tool call id → the working tree's state when it started; null outside git.
  const before = new Map<string, Promise<string | null>>();

  pi.on("tool_call", async (event, ctx) => {
    const { background } = event.input as { background?: unknown };
    if (event.toolName !== "bash" || background) return;
    const start = tree(ctx.cwd);
    before.set(event.toolCallId, start);
    await start;
  });

  pi.on("tool_result", async (event, ctx) => {
    const start = await before.get(event.toolCallId);
    before.delete(event.toolCallId);
    if (!start) return;
    const end = await tree(ctx.cwd);
    const edits = end
      ? await changedFiles(ctx.cwd, start, end).catch(() => [])
      : [];
    if (!edits.length) return;
    return { details: { ...(event.details as object), edits } };
  });

  pi.on("session_shutdown", () => rm(indexFile, { force: true }));
}
