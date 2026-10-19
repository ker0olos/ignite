import { isAbsolute, relative } from "node:path";

// By workspace path, on globalThis: extensions, which wait on it, load afresh per session.
const KEY = Symbol.for("ignite.worktreeReady");
const shared = globalThis as { [KEY]?: Map<string, Promise<void>> };
const pending = (shared[KEY] ??= new Map<string, Promise<void>>());

/** Notes that the workspace at `path` is ready (its ignored files cloned in) once `ready` settles. */
export function setReady(path: string, ready: Promise<void>) {
  pending.set(path, ready);
  void ready.finally(() => {
    if (pending.get(path) === ready) pending.delete(path);
  });
}

const within = (dir: string, path: string) => {
  const rel = relative(path, dir);
  return !rel.startsWith("..") && !isAbsolute(rel);
};

/** Settles once the workspace `dir` is in is ready: at once when it is, or `dir` is in none. */
export async function whenReady(dir: string) {
  const waiting = [...pending].filter(([path]) => within(dir, path));
  await Promise.all(waiting.map(([, ready]) => ready));
}
