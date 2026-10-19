import { isAbsolute, relative } from "node:path";

// Cloning a big folder's ignored files starves Claude Code's start of the disk,
// so it waits for the first reply to stream, a call that needs them, or this.
const START_AFTER_MS = 10_000;

type Entry = { clone: () => Promise<void>; ready?: Promise<void> };

// By workspace path, on globalThis: extensions, which wait on it, load afresh per session.
const KEY = Symbol.for("ignite.worktreeReady");
const shared = globalThis as { [KEY]?: Map<string, Entry> };
const pending = (shared[KEY] ??= new Map<string, Entry>());

function begin(path: string, entry: Entry) {
  entry.ready ??= entry.clone().finally(() => {
    if (pending.get(path) === entry) pending.delete(path);
  });
  return entry.ready;
}

/** Notes that the workspace at `path` is ready (its ignored files cloned in) once `clone` has run; it starts on first need. */
export function setReady(path: string, clone: () => Promise<void>) {
  const entry: Entry = { clone };
  pending.set(path, entry);
  // Not once dropped: it would clone into a deleted workspace.
  const later = () => pending.get(path) === entry && void begin(path, entry);
  setTimeout(later, START_AFTER_MS).unref();
}

const within = (dir: string, path: string) => {
  const rel = relative(path, dir);
  return !rel.startsWith("..") && !isAbsolute(rel);
};

const containing = (dir: string) =>
  [...pending].filter(([path]) => within(dir, path));

/** Starts readying the workspace `dir` is in, if it hasn't started. */
export function startReady(dir: string) {
  for (const [path, entry] of containing(dir)) void begin(path, entry);
}

/** Settles once the workspace `dir` is in is ready, starting it: at once when it is, or `dir` is in none. */
export async function whenReady(dir: string) {
  await Promise.all(containing(dir).map(([path, entry]) => begin(path, entry)));
}

/** For the workspace at `path` about to be deleted: forgets a clone not started yet, or waits for one that has; returns what puts a forgotten one back, should it stay. */
export async function dropReady(path: string) {
  const entry = pending.get(path);
  if (entry && !entry.ready) {
    pending.delete(path);
    return () => setReady(path, entry.clone);
  }
  await entry?.ready;
  return () => {};
}
