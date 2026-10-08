/** Tasks as they cross the wire: what the user hands an agent, and what it reports back. */
import type { ImageContent, ToolResult } from "./agentTypes.ts";
import type { ThinkingLevel } from "./hostProtocol.ts";

/** The tool a task's agent reports its progress with. */
export const TASK_TOOL = "task_update";

/** What a task_update call returns beside its text: the subtasks after it. */
export type PlanDetails = { subtasks: Subtask[] };

/** A task_update call's subtasks; undefined for other calls, an empty plan, or ones saved before it reported them. */
export function readPlan(
  result: ToolResult | undefined,
): Subtask[] | undefined {
  const d = result?.details as Partial<PlanDetails> | undefined;
  return Array.isArray(d?.subtasks) && d.subtasks.length
    ? d.subtasks
    : undefined;
}

/** The tool any other conversation adds tasks to the list with, once the user approves. */
export const TASK_ADD_TOOL = "task_add";

/** A task as the agent proposes it to task_add. */
export type ProposedTask = {
  title: string;
  notes?: string;
  subtasks?: string[];
};

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
  /** A conversation from the composer that planned its work: the user follows it there, so it isn't autonomous. */
  interactive?: true;
};

/** Whether `task` runs with nobody watching: one started from the Tasks view. */
export const autonomous = (task: Task | null): boolean =>
  !!task && !task.interactive;

/** The task a composer conversation joins the list with when it first plans. */
export function conversationTask(
  session: string,
  title: string,
  now: number,
): Task {
  return {
    id: crypto.randomUUID(),
    title: title || "Conversation",
    notes: "",
    images: [],
    subtasks: [],
    created: now,
    updated: now,
    session,
    interactive: true,
  };
}

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
  /** Starts the task in a new conversation and sends it the task; `interactive`, one the user follows. */
  | {
      id: number;
      type: "task_start";
      cwd: string;
      taskId: string;
      interactive?: boolean;
    }
  /** Sends a started task's conversation `text`, reopening it if it closed. */
  | {
      id: number;
      type: "task_resume";
      cwd: string;
      taskId: string;
      text: string;
    }
  /** The open items of the .todo files in the folder and the folders directly in it. */
  | { id: number; type: "todo_list"; cwd: string }
  /** Removes a .todo item from its file. */
  | { id: number; type: "todo_delete"; cwd: string; item: TodoItem };

/** Each task request resolves to the folder's tasks; todo_list to its .todo items. */
export type TaskResponses = Record<
  Exclude<TaskRequest["type"], "todo_list" | "todo_delete">,
  Task[]
> & { todo_list: TodoItem[]; todo_delete: TodoItem[] };

/** An open item of a .todo file in the folder (`folder` ""), or in a folder directly in it. */
export type TodoItem = {
  folder: string;
  section?: string;
  title: string;
  notes: string;
};

/** What a task's agent may change with the task tool (see TASK_TOOL). */
export type TaskUpdate = {
  /** Statuses to set, by the subtask's 1-based index. */
  set?: { subtask: number; status: SubtaskStatus }[];
  /** Subtasks to drop, by 1-based index before this update; applied after `set`, before `add`. */
  remove?: number[];
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
  const subtasks = task.subtasks.flatMap((s, i) => {
    if (update.remove?.includes(i + 1)) return [];
    const set = update.set?.findLast((u) => u.subtask === i + 1);
    return [set ? { ...s, status: set.status } : s];
  });
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

/** task_add's tasks from the call's arguments, skipping ones without a title. */
export function readProposed(args: Record<string, unknown>): ProposedTask[] {
  if (!Array.isArray(args.tasks)) return [];
  return args.tasks.filter(
    (t): t is ProposedTask => typeof t?.title === "string" && !!t.title.trim(),
  );
}

/** A new, unstarted task from a proposed one. */
export function proposedTask(p: ProposedTask, id: string, now: number): Task {
  return {
    id,
    title: p.title.trim(),
    notes: p.notes?.trim() ?? "",
    images: [],
    subtasks: (p.subtasks ?? [])
      .filter((s) => s.trim())
      .map((s) => ({ title: s.trim(), status: "todo" })),
    created: now,
    updated: now,
  };
}

/** The pull request's URL in `gh pr create`'s output, if it has one. */
export function prUrl(output: string): string | null {
  return /https:\/\/\S+\/pull\/\d+/.exec(output)?.[0] ?? null;
}
