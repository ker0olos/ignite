// The memory's sleep: after a run, a file's (or the procedures') pile of memories becomes a few long-term ones,
// judged against the file now and its commits; what they replace, or show false, is retired, never deleted.
import { access, readFile, realpath } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { askModel, cheapest } from "./cheapCall.ts";
import { run } from "./gitRun.ts";
import { log } from "./hostLog.ts";
import type { Agent } from "./hostTypes.ts";
import { learningOn } from "./learningSettings.ts";
import { memoryEnabled } from "./memory.ts";
import { memoryDb, type Memory } from "./memoryDb.ts";
import {
  consolidationPrompt,
  memberLines,
  parseOutcome,
} from "./memoryConsolidatePrompt.ts";
import {
  applyOutcome,
  fileKey,
  groups,
  isFileKey,
  triedKey,
  type Group,
  type Tried,
} from "./memoryGroups.ts";
import { outline, outlines } from "./outline.ts";

const PASSES = 2;
const NOW_CHARS = 6_000;
const TIMEOUT_MS = 120_000;
const GIT_TIMEOUT_MS = 10_000;

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

/** Runs git on `folder`'s file `key` from its nearest folder that exists: a folder of repositories has its git in each, not at its root. */
async function git(folder: string, key: string, args: string[]) {
  let cwd = dirname(join(folder, key));
  while (cwd.length > folder.length && !(await exists(cwd))) cwd = dirname(cwd);
  const path = relative(cwd, join(folder, key));
  return run("git", [...args, "--", path], {
    cwd,
    timeout: GIT_TIMEOUT_MS,
  }).catch(() => ({ output: "", code: 1 }));
}

const tracked = async (folder: string, key: string) =>
  (await git(folder, key, ["ls-files", "--error-unmatch"])).code === 0;

// Through a link anywhere on its path, a file may be outside the folder.
const outside = async (folder: string, path: string) =>
  relative(await realpath(folder), await realpath(path)).startsWith("..");

/** `folder`'s file `key` as the model reads it: a code file's definitions, else the start of one git tracks (an untracked one, like .env, may hold secrets); never one a link takes outside the folder. */
async function fileNow(folder: string, key: string): Promise<string> {
  const path = join(folder, key);
  try {
    if (await outside(folder, path)) return "(outside the folder, not read)";
    if (outlines(path)) return (await outline(path)).slice(0, NOW_CHARS);
    if (!(await tracked(folder, key))) return "(not tracked by git, not read)";
    return (await readFile(path, "utf8")).slice(0, NOW_CHARS);
  } catch {
    return "(it no longer exists)";
  }
}

async function commitsSince(folder: string, key: string, since: number) {
  // Every branch: the agents' work lives in their worktrees' branches before it reaches the checkout. Not the app's own checkpoints.
  const args = [
    "log",
    "--exclude=refs/ignite/*",
    "--all",
    "--no-renames",
    "--format=%h %ad %s",
    "--date=short",
  ];
  const { output, code } = await git(folder, key, [
    ...args,
    `--since=${new Date(since).toISOString()}`,
    "-n",
    "30",
  ]);
  return code === 0 ? output.trim() || "(none)" : null;
}

/** When `key` was deleted in `folder`'s git; null when git shows no deletion. */
async function deletedAt(folder: string, key: string): Promise<number | null> {
  const { output, code } = await git(folder, key, [
    "log",
    "-1",
    "--no-renames",
    "--diff-filter=D",
    "--format=%ct",
  ]);
  const seconds = Number(output.trim());
  return code === 0 && seconds > 0 ? seconds * 1000 : null;
}

/** What a pass over `group` starts from: its raw memories of only its file from before git deleted it, stale with no model call; null when the file isn't in the checkout yet (work still on a branch). */
async function startOf(folder: string, group: Group) {
  if (!isFileKey(group.key) || (await exists(join(folder, group.key))))
    return [];
  const gone = await deletedAt(folder, group.key);
  if (gone === null) return null;
  const only = (m: Memory) =>
    m.filesModified.every((p) => fileKey(folder, p) === group.key);
  return group.raw
    .filter((m) => m.createdAt < gone && only(m))
    .map((m) => ({ id: m.id, reason: `its file ${group.key} was deleted` }));
}

/** What the model weighs `group` against: the file now and its commits since; nothing for the procedures or a topic. */
async function evidence(folder: string, group: Group): Promise<string> {
  if (!isFileKey(group.key)) return "";
  const oldest = Math.min(...group.raw.map((m) => m.createdAt));
  const commits = await commitsSince(folder, group.key, oldest);
  return [
    `The file as it is now (${group.key}):\n${await fileNow(folder, group.key)}`,
    ...(commits
      ? [`Commits that changed it since the oldest memory:\n${commits}`]
      : []),
  ].join("\n\n");
}

type Session = NonNullable<Agent["session"]>;
type Model = NonNullable<Awaited<ReturnType<typeof cheapest>>>["model"];

async function ask(s: Session, model: Model, folder: string, group: Group) {
  const input = [memberLines(group), await evidence(folder, group)]
    .filter(Boolean)
    .join("\n\n");
  const reply = await askModel(s, model, consolidationPrompt(group), input, {
    label: `consolidation of ${group.key}`,
    timeoutMs: TIMEOUT_MS,
  });
  return reply === null ? null : parseOutcome(reply, folder, group);
}

/** One pass over `group` by `model`; false when nothing came of it (its file isn't in the checkout yet, the call failed, or its reply wasn't an outcome). */
async function pass(
  s: Session,
  model: Model,
  db: DatabaseSync,
  folder: string,
  group: Group,
): Promise<boolean> {
  const freed = await startOf(folder, group);
  if (!freed) return false;
  const left = group.raw.filter((m) => !freed.some((f) => f.id === m.id));
  const outcome = left.length
    ? await ask(s, model, folder, { ...group, raw: left })
    : { entries: [], stale: [] };
  if (!outcome) return false;
  // The whole group, so the key's next pass starts after its newest memory.
  applyOutcome(db, folder, group, {
    ...outcome,
    stale: [...freed, ...outcome.stale],
  });
  return true;
}

// One consolidation at a time in a sidecar; a group whose pass came to nothing waits until it grows.
const tried: Tried = new Map();
let running = false;

/** Consolidates up to PASSES of `agent`'s folder's groups on its session's cheapest model, unless memory is off or a consolidation already runs. */
export async function consolidate(agent: Agent, db?: DatabaseSync) {
  const s = agent.session;
  if (running || !s) return;
  // Before any await, so two runs settling together can't both start.
  running = true;
  try {
    if (!(await memoryEnabled())) return;
    const store = db ?? memoryDb();
    const procedures = await learningOn("procedures");
    await passes(s, store, agent.cwd, procedures);
  } catch (error) {
    log(`consolidation failed: ${error}`);
  } finally {
    running = false;
  }
}

async function passes(
  s: Session,
  db: DatabaseSync,
  folder: string,
  procedures: boolean,
) {
  const ready = groups(db, folder, { skip: tried, procedures });
  let next = ready.next();
  // Most settles have nothing ready: no model lookup for them.
  const found = next.done ? null : await cheapest(s);
  for (let done = 1; found && !next.done; done++) {
    if (!(await pass(s, found.model, db, folder, next.value)))
      tried.set(triedKey(folder, next.value), next.value.newest);
    // Not one past the last pass: a topic group pulled is looked at again only next time.
    if (done === PASSES) break;
    next = ready.next();
  }
}
