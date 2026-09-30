import type {
  AgentStatus,
  ApprovalRequest,
  SessionState,
} from "../../shared/hostProtocol";
import type { Task, TaskImage } from "../../shared/tasks";
import { toImage } from "@/lib/images";

/** Where a task stands: not started, the agent on it, waiting on the user, its pull request declined, its work to review, or done. */
export type TaskStatus =
  "todo" | "working" | "waiting" | "declined" | "review" | "done";

/** A task with where it stands, and the pull request waiting for review, as the Tasks view shows it. */
export type ShownTask = Task & { status: TaskStatus; review?: ApprovalRequest };

/**
 * A task's status from its conversation's: a started one whose conversation
 * is idle, or no longer open, has finished and waits for review.
 */
export function taskStatus(task: Task, agent?: AgentStatus): TaskStatus {
  if (task.done) return "done";
  if (!task.session) return "todo";
  if (agent?.waiting) return "waiting";
  // Just started: open, but its first message hasn't arrived yet.
  if (agent && (agent.running || !agent.title)) return "working";
  return task.declined ? "declined" : "review";
}

/** Each task with its status, from the folder's conversations. */
export function withStatus(tasks: Task[], agents: AgentStatus[]): ShownTask[] {
  const bySession = new Map(agents.map((a) => [a.session, a]));
  return tasks.map((t) => {
    const agent = t.session ? bySession.get(t.session) : undefined;
    const status = taskStatus(t, agent);
    // A pull request waiting for approval is the work, ready for review.
    return status === "waiting" && agent?.review
      ? { ...t, status: "review" as const, review: agent.review }
      : { ...t, status };
  });
}

/** The Tasks view's groups, in the order they show. */
export const TASK_GROUPS: { label: string; statuses: TaskStatus[] }[] = [
  { label: "Needs you", statuses: ["waiting", "declined"] },
  { label: "In progress", statuses: ["working"] },
  { label: "Up next", statuses: ["review", "todo"] },
  { label: "Done", statuses: ["done"] },
];

/** A pull request's URL as its number ("#41"), or "Pull request" if it has none. */
export function prLabel(url: string) {
  const number = /\/pull\/(\d+)/.exec(url)?.[1];
  return number ? `#${number}` : "Pull request";
}

/** What a working task's card says it's doing: its step, else which phase it's in. */
export function workingLine(task: Task) {
  if (task.step) return task.step;
  return task.planned ? "Starting…" : "Planning the subtasks";
}

/** How many of a task's subtasks are done. */
export function doneCount(task: Task) {
  return task.subtasks.filter((s) => s.status === "done").length;
}

/** A task's images: the user's, then those its agent showed. */
export const allImages = (task: Task) => [
  ...task.images,
  ...(task.shown ?? []),
];

/** The heading's lead line: how many tasks run and how many wait on the user. */
export function tasksLead(tasks: ShownTask[]) {
  const count = (status: TaskStatus) =>
    tasks.filter((t) => t.status === status).length;
  const parts = [
    count("working") && `${count("working")} running on full auto`,
    count("waiting") && `${count("waiting")} waiting on you`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Nothing running";
}

/** What the new-task sheet collects. */
export type TaskDraft = Pick<
  Task,
  "title" | "notes" | "images" | "model" | "effort"
> & {
  subtasks: string[];
};

/** The model and effort the sheet shows, as a task keeps them. */
export function choicesOf(
  state: SessionState | null,
): Pick<TaskDraft, "model" | "effort"> {
  if (!state?.model) return {};
  const { provider, id } = state.model;
  return { model: { provider, id }, effort: state.thinkingLevel };
}

/** A new task from the sheet, not started. */
export function taskFromDraft(draft: TaskDraft, now = Date.now()): Task {
  return {
    id: crypto.randomUUID(),
    title: draft.title.trim(),
    notes: draft.notes.trim(),
    images: draft.images,
    subtasks: draft.subtasks
      .map((t) => t.trim())
      .filter(Boolean)
      .map((title) => ({ title, status: "todo" })),
    created: now,
    updated: now,
    ...(draft.model && { model: draft.model }),
    ...(draft.effort && { effort: draft.effort }),
  };
}

/** The images among `files`, read for a task; other files are left out. */
export async function taskImages(
  files: FileList | File[] | null,
): Promise<TaskImage[]> {
  return Promise.all(
    [...(files ?? [])]
      .filter((f) => f.type.startsWith("image/"))
      .map(async (f) => ({
        ...toImage(new Uint8Array(await f.arrayBuffer()), f.type),
        name: f.name,
      })),
  );
}

/** How long ago `time` was, briefly: "now", "5m", "3h", "2d". */
export function ago(time: number, now = Date.now()) {
  const minutes = Math.floor((now - time) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}
