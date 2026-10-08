import { applyUpdate, autonomous, type Task } from "../shared/tasks.ts";
import { current, type HostContext } from "./hostTypes.ts";
import { close, launch, prompt } from "./hostSession.ts";
import { runOn } from "./hostRoute.ts";
import { describeError } from "./wire.ts";
import type { TaskAsk } from "./taskExtension.ts";
import { createTaskStore, type TaskStore } from "./taskStore.ts";
import type { HostMessage } from "../shared/hostProtocol.ts";

/** A task as its conversation's first message; its first line titles the conversation. */
export function taskPrompt(task: Task): string {
  const parts = [task.title];
  if (task.notes.trim()) parts.push(task.notes.trim());
  if (task.subtasks.length) {
    const list = task.subtasks.map((s, i) => `${i + 1}. ${s.title}`);
    parts.push(`Subtasks:\n${list.join("\n")}`);
  }
  if (task.images.length) {
    parts.push(`Attached images: ${task.images.map((i) => i.name).join(", ")}`);
  }
  return parts.join("\n\n");
}

/**
 * Starts task `id` in a new conversation and sends it the task: on its own in
 * the background, or `interactive`, one the user follows, answering once it's open.
 */
export async function startTask(
  ctx: HostContext,
  cwd: string,
  id: string,
  interactive = false,
) {
  if (ctx.starting.has(id)) throw new Error("That task is already starting.");
  ctx.starting.add(id);
  try {
    return await begin(ctx, cwd, id, interactive);
  } finally {
    ctx.starting.delete(id);
  }
}

async function begin(
  ctx: HostContext,
  cwd: string,
  id: string,
  interactive: boolean,
) {
  const task = (await ctx.tasks.list(cwd)).find((t) => t.id === id);
  if (!task) throw new Error("That task no longer exists.");
  if (task.session) throw new Error("That task was already started.");
  const session = ctx.sessions.create();
  // Saved first, so the conversation finds its task when its run starts.
  const started: Task = {
    ...task,
    session,
    step: undefined,
    planned: undefined,
    pr: undefined,
    declined: undefined,
    shown: undefined,
    done: undefined,
    error: undefined,
    subtasks: task.subtasks.map((s) => ({ ...s, status: "todo" })),
    updated: Date.now(),
    ...(interactive && { interactive: true }),
  };
  const tasks = await ctx.tasks.change(cwd, (all) =>
    all.map((t) => (t.id === id ? started : t)),
  );
  const fail = (error: unknown) =>
    ctx.tasks.change(cwd, (all) =>
      all.map((t) =>
        t.id === id
          ? {
              ...t,
              session: undefined,
              error: describeError(error),
              updated: Date.now(),
            }
          : t,
      ),
    );
  const failed = async (error: unknown) => {
    await close(ctx, cwd, session).catch(() => {});
    return fail(error);
  };
  try {
    await launch(ctx, cwd, session);
  } catch (error) {
    return failed(error);
  }
  const send = async () => {
    try {
      await runOn(await current(ctx, session), task);
      const images = task.images.map(({ type, data, mimeType }) => ({
        type,
        data,
        mimeType,
      }));
      await prompt(ctx, taskPrompt(task), images, session, fail);
    } catch (error) {
      return failed(error);
    }
    return tasks;
  };
  // The user follows an interactive one in the conversation, routing and all.
  if (!interactive) return send();
  void send();
  return tasks;
}

/** Sends started task `id`'s conversation `text`, reopening it if it closed. */
export async function resumeTask(
  ctx: HostContext,
  cwd: string,
  id: string,
  text: string,
) {
  const task = (await ctx.tasks.list(cwd)).find((t) => t.id === id);
  if (!task?.session) throw new Error("That task hasn't started.");
  await launch(ctx, cwd, task.session);
  await prompt(ctx, text, undefined, task.session);
  return ctx.tasks.list(cwd);
}

/** Removes task `id`, ending its conversation if it's open here, unless the user follows it in the composer. */
export async function deleteTask(ctx: HostContext, cwd: string, id: string) {
  const task = (await ctx.tasks.list(cwd)).find((t) => t.id === id);
  if (task?.session && autonomous(task)) await close(ctx, cwd, task.session);
  return ctx.tasks.remove(cwd, id);
}

/** The tasks under `dir`, every change pushed to the app. */
export const taskStoreIn = (dir: string, send: (m: HostMessage) => void) =>
  createTaskStore(dir, (cwd, tasks) => send({ type: "tasks", cwd, tasks }));

/** Answers conversation `session`'s task tool from `folder`'s tasks, off its event bus. */
export const taskAnswerer =
  (store: TaskStore, folder: string, session: string) => (data: unknown) =>
    answerTask(store, folder, session, data as TaskAsk);

/** Answers a conversation's task tool (see taskExtension.ts) from `folder`'s tasks. */
export async function answerTask(
  store: TaskStore,
  folder: string,
  session: string,
  ask: TaskAsk,
) {
  ask.heard = true;
  const mine = (tasks: Task[]) =>
    tasks.find((t) => t.session === session) ?? null;
  try {
    if (ask.kind === "add") {
      await store.change(folder, (tasks) => [...tasks, ...ask.tasks]);
      ask.reply(ask.tasks[0] ?? null);
      return;
    }
    const tasks =
      ask.kind === "get"
        ? await store.list(folder)
        : await store.updateBySession(folder, session, (t) =>
            applyUpdate(t, ask.update, Date.now()),
          );
    ask.reply(mine(tasks));
  } catch {
    // The agent must never wait on a task file it can't read or write.
    ask.reply(null);
  }
}
