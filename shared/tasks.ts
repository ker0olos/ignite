/** Tasks as they cross the wire: what the user hands an agent, and what it reports back. */
import type { ImageContent } from "./agentTypes.ts";
import type { ThinkingLevel } from "./hostProtocol.ts";

/** The tool a task's agent reports its progress with. */
export const TASK_TOOL = "task_update";

type SubtaskStatus = "todo" | "working" | "done";

export type Subtask = { title: string; status: SubtaskStatus };

/** An image given to a task, sent with its first prompt. */
export type TaskImage = ImageContent & { name: string };

export type Task = {
  id: string;
  title: string;
  notes: string;
  images: TaskImage[];
  subtasks: Subtask[];
  /** Epoch ms. */
  created: number;
  updated: number;
  /** Its conversation, once started. */
  session?: string;
  /** What the agent is doing, from its latest tool call. */
  step?: string;
  /** The agent has laid out or confirmed the subtasks, so it may change files. */
  planned?: boolean;
  /** The pull request its work was delivered in. */
  pr?: string;
  /** Why its last start failed; cleared when it starts again. */
  error?: string;
  /** The user marked it done. */
  done?: boolean;
  /** What its conversation runs on; unset uses the saved defaults. */
  model?: { provider: string; id: string };
  effort?: ThinkingLevel;
};

/** The fields a user may change on a task; the agent's progress is never one of them. */
export const USER_FIELDS = [
  "title",
  "notes",
  "images",
  "subtasks",
  "done",
  "model",
  "effort",
] as const;

export type TaskEdit = Partial<Pick<Task, (typeof USER_FIELDS)[number]>>;

/** Which task to edit, and the user's changes to it. */
export type TaskPatch = { taskId: string; patch: TaskEdit };

/** What a task's agent may change with the task tool (see TASK_TOOL). */
export type TaskUpdate = {
  /** 1-based index of the subtask to set. */
  subtask?: number;
  status?: SubtaskStatus;
  /** Subtasks to append. */
  add?: string[];
  step?: string;
  planned?: true;
  pr?: string;
};

/** Applies an agent's update; out-of-range subtasks are ignored. */
export function applyUpdate(task: Task, update: TaskUpdate, now: number): Task {
  const subtasks = task.subtasks.map((s, i) =>
    update.status && update.subtask === i + 1
      ? { ...s, status: update.status }
      : s,
  );
  for (const title of update.add ?? []) {
    if (title.trim()) subtasks.push({ title: title.trim(), status: "todo" });
  }
  const { step, planned, pr } = update;
  return {
    ...task,
    subtasks,
    ...(step !== undefined && { step: step.trim() }),
    ...(planned && { planned }),
    ...(pr && { pr }),
    updated: now,
  };
}

/** Whether the task still has work to wrap up: subtasks not done, or no pull request. */
export function unfinished(task: Task): boolean {
  return !task.pr || task.subtasks.some((s) => s.status !== "done");
}

/** The pull request's URL in `gh pr create`'s output, if it has one. */
export function prUrl(output: string): string | null {
  return /https:\/\/\S+\/pull\/\d+/.exec(output)?.[0] ?? null;
}
