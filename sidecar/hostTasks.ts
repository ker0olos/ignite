import { applyUpdate, type Task } from "../shared/tasks.ts";
import { current, type HostContext, type Session } from "./hostTypes.ts";
import { launch, prompt } from "./hostSession.ts";
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

// Not persisted: a task's pick never becomes the default for new conversations.
// A model that's no longer available leaves the default.
async function runOn(s: Session, { model, effort }: Task) {
  const found =
    model &&
    (await s.modelRuntime.getAvailable()).find(
      (m) => m.provider === model.provider && m.id === model.id,
    );
  if (found) await s.setModel(found, { persist: false });
  if (effort) s.setThinkingLevel(effort, { persist: false });
}

/**
 * Starts task `id` in a new conversation that runs in the background (the
 * Tasks view follows it, the chat isn't switched), and sends it the task.
 */
export async function startTask(ctx: HostContext, cwd: string, id: string) {
  const task = (await ctx.tasks.list(cwd)).find((t) => t.id === id);
  if (!task) throw new Error("That task no longer exists.");
  if (task.session && ctx.agents.has(task.session)) {
    throw new Error("That task is already running.");
  }
  const session = ctx.sessions.create();
  // Saved first, so the conversation finds its task when its run starts.
  const started = { ...task, session, step: undefined, updated: Date.now() };
  const tasks = await ctx.tasks.save(cwd, started);
  await launch(ctx, cwd, session);
  await runOn(await current(ctx, session), task);
  const images = task.images.map(({ type, data, mimeType }) => ({
    type,
    data,
    mimeType,
  }));
  await prompt(ctx, taskPrompt(task), images, session);
  return tasks;
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
