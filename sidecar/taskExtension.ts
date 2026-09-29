/**
 * The task tool, and the life of a task's conversation: plan (lay out or
 * confirm the subtasks, before any file changes), work (its step is taken
 * from each tool call), then wrap up (subtasks done, commit, pull request),
 * nudged once if a run ends short of that. It runs on its own: no ask_user,
 * and no chrome_* tools, which would prompt in the user's own Chrome. Other
 * conversations don't get the tool. Loaded after askExtension, whose
 * guidance it replaces.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { ASK_TOOL } from "../shared/questions.ts";
import {
  TASK_TOOL,
  unfinished,
  type Task,
  type TaskUpdate,
} from "../shared/tasks.ts";
import { ASKING, AUTONOMOUS } from "./askExtension.ts";
import { CHANGES_FILES, stepOf } from "./taskSteps.ts";

/** pi event bus channel carrying a TaskAsk to the host. */
export const TASK_EVENT = "app/task";

/**
 * The session's task, or an update to it; `reply` gets the task, or null if
 * it has none. The host sets `heard` as it receives it (listeners run during
 * `emit`), so a session nobody answers for isn't left waiting.
 */
export type TaskAsk = { heard: boolean; reply(task: Task | null): void } & (
  { kind: "get" } | { kind: "update"; update: TaskUpdate }
);

/** Asks the host for this session's task, or updates it; null if it has none. */
export const askTask = (
  pi: Pick<ExtensionAPI, "events">,
  kind: "get" | "update",
  update: TaskUpdate = {},
): Promise<Task | null> =>
  new Promise((reply) => {
    const ask = { kind, update, reply, heard: false } as TaskAsk;
    pi.events.emit(TASK_EVENT, ask);
    if (!ask.heard) reply(null);
  });

export const TASK_GUIDANCE = `## Working on a task
This conversation carries out a task from the user's task list; the user follows it there, not in the chat. Work in three phases, keeping the subtasks current with the ${TASK_TOOL} tool:
1. Plan: read what you need, then call ${TASK_TOOL} to add the subtasks the work needs, or to confirm the ones given (you can't change files until you have).
2. Work: before starting a subtask, set it to "working"; when it's finished, set it to "done". Work through them in order.
3. Deliver: when every subtask is done, create a branch named for the task, commit, push, and open a pull request. If the folder can't take one (not a git repository, no remote, or gh not signed in), leave the changes uncommitted and say why.
Only stop for the user when you can't go on without them. End with a short summary of what you did.`;

export const PLAN_FIRST = `Plan first: call ${TASK_TOOL} to add the task's subtasks, or to confirm the ones it has, before changing files.`;

export const WRAP_UP = `Wrap up the task: set every finished subtask to "done" with ${TASK_TOOL}, then commit on a branch, push, and open a pull request. If the folder can't take one, leave the changes uncommitted and say why.`;

const Params = Type.Object({
  subtask: Type.Optional(
    Type.Integer({ minimum: 1, description: "The subtask's number, from 1." }),
  ),
  status: Type.Optional(
    Type.Union([
      Type.Literal("todo"),
      Type.Literal("working"),
      Type.Literal("done"),
    ]),
  ),
  add: Type.Optional(
    Type.Array(Type.String(), { description: "Subtasks to append." }),
  ),
});

/** The task's subtasks as the model reads them back. */
export function progressText(task: Task): string {
  if (!task.subtasks.length) return "Updated. The task has no subtasks.";
  return task.subtasks
    .map((s, i) => `${i + 1}. [${s.status}] ${s.title}`)
    .join("\n");
}

// A run the user stopped, or that failed, isn't nudged on.
function endedNormally(messages: readonly unknown[]) {
  const last = messages.at(-1) as { stopReason?: string } | undefined;
  return last?.stopReason !== "aborted" && last?.stopReason !== "error";
}

export default function tasks(pi: ExtensionAPI) {
  // Whether this conversation has a task; asked once, then on every run.
  let isTask: Promise<boolean> | null = null;
  // One wrap-up nudge per run the user started.
  let nudged = false;

  pi.registerTool({
    name: TASK_TOOL,
    label: "Update the task",
    description:
      "Report progress on this conversation's task: add subtasks, confirm them (call with no changes), or set a subtask's status.",
    parameters: Params,
    async execute(_toolCallId, params) {
      const task = await askTask(pi, "update", { ...params, planned: true });
      const text = task ? progressText(task) : "This conversation has no task.";
      return { content: [{ type: "text", text }], details: undefined };
    },
  });

  pi.on("before_agent_start", async (event) => {
    const task = await askTask(pi, "get");
    isTask = Promise.resolve(!!task);
    if (event.prompt !== WRAP_UP) nudged = false;
    const others = pi
      .getActiveTools()
      .filter(
        (name) =>
          name !== TASK_TOOL &&
          !(task && (name === ASK_TOOL || name.startsWith("chrome_"))),
      );
    pi.setActiveTools(task ? [...others, TASK_TOOL] : others);
    if (!task) return;
    const prompt = event.systemPrompt.replace(ASKING, AUTONOMOUS);
    return { systemPrompt: `${prompt}\n\n${TASK_GUIDANCE}` };
  });

  pi.on("tool_call", async (event, ctx) => {
    isTask ??= askTask(pi, "get").then((task) => !!task);
    if (!(await isTask)) return;
    if (CHANGES_FILES.has(event.toolName)) {
      const task = await askTask(pi, "get");
      if (task && !task.planned) return { block: true, reason: PLAN_FIRST };
    }
    const step = stepOf(event.toolName, event.input, ctx.cwd);
    if (step) void askTask(pi, "update", { step });
  });

  pi.on("agent_end", async (event) => {
    if (nudged || !(await isTask) || !endedNormally(event.messages)) return;
    const task = await askTask(pi, "get");
    if (!task || !unfinished(task)) return;
    nudged = true;
    pi.sendUserMessage(WRAP_UP, { deliverAs: "followUp" });
  });
}
