import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Task } from "../shared/tasks.ts";

type Saved = { cwd: string; tasks: Task[] };

/**
 * Each folder's tasks, one JSON file per folder under `dir` (null keeps them
 * in memory, for tests). Every change goes to `changed`, so every window and
 * the Tasks view follow the agent's updates.
 */
// ponytail: images live inline as base64 in the folder's file; move them to files if it grows slow.
export function createTaskStore(
  dir: string | null,
  changed: (cwd: string, tasks: Task[]) => void = () => {},
) {
  const memory = new Map<string, Task[]>();
  // Writes to one folder run one at a time, so none overwrites another.
  const queues = new Map<string, Promise<unknown>>();
  const file = (cwd: string) =>
    join(
      dir!,
      `${createHash("sha256").update(cwd).digest("hex").slice(0, 16)}.json`,
    );

  async function list(cwd: string): Promise<Task[]> {
    if (!dir) return memory.get(cwd) ?? [];
    try {
      return (JSON.parse(await readFile(file(cwd), "utf8")) as Saved).tasks;
    } catch {
      return [];
    }
  }

  async function write(cwd: string, tasks: Task[]) {
    if (!dir) {
      memory.set(cwd, tasks);
      return;
    }
    await mkdir(dir, { recursive: true });
    const temp = `${file(cwd)}.tmp`;
    await writeFile(temp, JSON.stringify({ cwd, tasks } satisfies Saved));
    await rename(temp, file(cwd));
  }

  /** Rewrites the folder's tasks with `edit`, and reports the result; an edit returning its input changes nothing. */
  function change(cwd: string, edit: (tasks: Task[]) => Task[]) {
    const run = (queues.get(cwd) ?? Promise.resolve())
      .catch(() => {})
      .then(async () => {
        const before = await list(cwd);
        const tasks = edit(before);
        if (tasks === before) return tasks;
        await write(cwd, tasks);
        changed(cwd, tasks);
        return tasks;
      });
    queues.set(cwd, run);
    return run;
  }

  return {
    list,
    change,
    /** Adds the task, or replaces the one with its id. */
    save: (cwd: string, task: Task) =>
      change(cwd, (tasks) =>
        tasks.some((t) => t.id === task.id)
          ? tasks.map((t) => (t.id === task.id ? task : t))
          : [...tasks, task],
      ),
    remove: (cwd: string, id: string) =>
      change(cwd, (tasks) => tasks.filter((t) => t.id !== id)),
    /** Edits the task working in conversation `session`, if there is one. */
    updateBySession: (
      cwd: string,
      session: string,
      edit: (task: Task) => Task,
    ) =>
      change(cwd, (tasks) =>
        tasks.some((t) => t.session === session)
          ? tasks.map((t) => (t.session === session ? edit(t) : t))
          : tasks,
      ),
  };
}

export type TaskStore = ReturnType<typeof createTaskStore>;
