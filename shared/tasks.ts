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
  /** The user declined its pull request; cleared when its agent runs again. */
  declined?: boolean;
  /** Images the agent showed with show_image, newest last. */
  shown?: TaskImage[];
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
type TaskPatch = { taskId: string; patch: TaskEdit };

/** The app's requests about a folder's tasks. */
export type TaskRequest =
  | { id: number; type: "tasks_list"; cwd: string }
  /** Adds a new task; an existing id is an error. */
  | { id: number; type: "task_save"; cwd: string; task: Task }
  /** Changes the task's user fields only, keeping the agent's progress. */
  | ({ id: number; type: "task_edit"; cwd: string } & TaskPatch)
  | { id: number; type: "task_delete"; cwd: string; taskId: string }
  /** Starts the task in a new background conversation and sends it the task. */
  | { id: number; type: "task_start"; cwd: string; taskId: string }
  /** Sends a started task's conversation `text`, reopening it if it closed. */
  | {
      id: number;
      type: "task_resume";
      cwd: string;
      taskId: string;
      text: string;
    };

/** Each task request resolves to the folder's tasks. */
export type TaskResponses = Record<TaskRequest["type"], Task[]>;

/** What a task's agent may change with the task tool (see TASK_TOOL). */
export type TaskUpdate = {
  /** 1-based index of the subtask to set. */
  subtask?: number;
  status?: SubtaskStatus;
  /** Subtasks to append. */
  add?: string[];
  step?: string;
  planned?: true;
  /** The pull request the user approved, which completes the task. */
  pr?: string;
  declined?: boolean;
  /** An image the agent showed, added to the task. */
  image?: TaskImage;
};

// ponytail: shown images live inline in the task file, rewritten and pushed on
// every update, so only the latest few within a budget are kept; files if more matter.
const MAX_SHOWN = 6;
const MAX_SHOWN_CHARS = 8_000_000;

/**
 * `shown` with `image` added, within MAX_SHOWN and MAX_SHOWN_CHARS of base64
 * (oldest dropped first); an image too big alone isn't kept and costs nothing.
 */
function addShown(shown: TaskImage[], image: TaskImage): TaskImage[] {
  if (image.data.length > MAX_SHOWN_CHARS) return shown;
  const kept = [...shown, image].slice(-MAX_SHOWN);
  let size = kept.reduce((n, i) => n + i.data.length, 0);
  while (size > MAX_SHOWN_CHARS) size -= kept.shift()!.data.length;
  return kept;
}

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
  const { step, planned, pr, declined, image } = update;
  return {
    ...task,
    subtasks,
    ...(step !== undefined && { step: step.trim() }),
    ...(planned && { planned }),
    ...(declined !== undefined && { declined }),
    ...(pr && { pr, done: true, declined: false }),
    ...(image && { shown: addShown(task.shown ?? [], image) }),
    updated: now,
  };
}

/**
 * Whether the task still has work to wrap up: subtasks not done, or no pull
 * request. A declined one waits for the user instead.
 */
export function unfinished(task: Task): boolean {
  if (task.declined) return false;
  return !task.pr || task.subtasks.some((s) => s.status !== "done");
}

/** The pull request's URL in `gh pr create`'s output, if it has one. */
export function prUrl(output: string): string | null {
  return /https:\/\/\S+\/pull\/\d+/.exec(output)?.[0] ?? null;
}
