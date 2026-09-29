import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { USER_FIELDS, type Task, type TaskEdit } from "../shared/tasks.ts";

type Saved = { cwd: string; tasks: Task[] };

const pickUser = (patch: TaskEdit): TaskEdit =>
  Object.fromEntries(
    USER_FIELDS.filter((k) => k in patch).map((k) => [k, patch[k]]),
  );

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
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw new Error(
        `Can't read the tasks file ${file(cwd)}: ${(e as Error).message}`,
        { cause: e },
      );
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
    /** Adds a new task; an existing id throws. */
    save: (cwd: string, task: Task) =>
      change(cwd, (tasks) => {
        if (tasks.some((t) => t.id === task.id))
          throw new Error("That task already exists.");
        return [...tasks, task];
      }),
    /** Merges the user's fields into the task inside the queue, so the agent's progress survives. */
    edit: (cwd: string, id: string, patch: TaskEdit) =>
      change(cwd, (tasks) =>
        tasks.some((t) => t.id === id)
          ? tasks.map((t) =>
              t.id === id
                ? { ...t, ...pickUser(patch), updated: Date.now() }
                : t,
            )
          : tasks,
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
