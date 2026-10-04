/**
 * The task tool, and the life of every conversation's work: plan (lay out or
 * confirm the subtasks, before any file changes; a composer conversation
 * joins the task list then), work (its step is taken from each tool call).
 * A task started from the Tasks view also wraps up (subtasks done, commit,
 * pull request), nudged once if a run ends short of that, and runs on its
 * own: no ask_user, and its chrome_* tools drive the app's own Chrome
 * (chromeExtension.ts). Loaded after askExtension, whose guidance it replaces.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { IMAGE_TOOL } from "../shared/agentTypes.ts";
import { ASK_TOOL } from "../shared/questions.ts";
import { firstTitle } from "../shared/conversations.ts";
import {
  TASK_ADD_TOOL,
  TASK_TOOL,
  autonomous,
  conversationTask,
  unfinished,
  type Task,
  type TaskUpdate,
} from "../shared/tasks.ts";
import { ASKING, AUTONOMOUS } from "./askExtension.ts";
import { COMMAND_GUIDANCE, TASK_COMMAND_GUIDANCE } from "./bashExtension.ts";
import { registerTaskAdd } from "./taskAddTool.ts";
import { stepOf } from "../shared/steps.ts";
import { CHANGES_FILES } from "./taskSteps.ts";

/** pi event bus channel carrying a TaskAsk to the host. */
export const TASK_EVENT = "app/task";

/**
 * The session's task, or an update to it; `reply` gets the task, or null if
 * it has none. The host sets `heard` as it receives it (listeners run during
 * `emit`), so a session nobody answers for isn't left waiting.
 */
export type TaskAsk = { heard: boolean; reply(task: Task | null): void } & (
  | { kind: "get" }
  | { kind: "update"; update: TaskUpdate }
  /** Adds new tasks to the folder's list; replies with the first, or null if they weren't saved. */
  | { kind: "add"; tasks: Task[] }
);

const ask = (
  pi: Pick<ExtensionAPI, "events">,
  body:
    | { kind: "get" }
    | { kind: "update"; update: TaskUpdate }
    | { kind: "add"; tasks: Task[] },
): Promise<Task | null> =>
  new Promise((reply) => {
    const sent = { ...body, reply, heard: false } as TaskAsk;
    pi.events.emit(TASK_EVENT, sent);
    if (!sent.heard) reply(null);
  });

/** Asks the host for this session's task, or updates it; null if it has none. */
export const askTask = (
  pi: Pick<ExtensionAPI, "events">,
  kind: "get" | "update",
  update: TaskUpdate = {},
): Promise<Task | null> =>
  ask(pi, kind === "get" ? { kind } : { kind, update });

export const TASK_GUIDANCE = `## Working on a task
This conversation carries out a task from the user's task list; the user follows it there, not in the conversation. Work in three phases, keeping the subtasks current with the ${TASK_TOOL} tool:
1. Plan: read what you need, then call ${TASK_TOOL} to add the subtasks the work needs, or to confirm the ones given (you can't change files until you have).
2. Work: before starting a subtask, set it to "working"; when it's finished, set it to "done". Work through them in order.
3. Deliver: when every subtask is done, create a branch named for the task, commit, push, and open a pull request; the user reviews it before it opens. If the folder can't take one (not a git repository, no remote, or gh not signed in), leave the changes uncommitted and say why.
When the work has something to look at (a page, a screen, a chart), show an image of it with ${IMAGE_TOOL}; it's added to the task for the user to see.
Only stop for the user when you can't go on without them. End with a short summary of what you did.`;

/** Added when the task has the Chrome tools (Settings may turn them off). */
export const CHROME_GUIDANCE = `The chrome_* tools drive a separate Chrome that's yours for this task, not the user's: act freely in it, including filling in and submitting forms. Open your own tab with chrome_navigate and new_tab: true, and name it by id in every call; other tabs are refused. Check pages you build there; chrome_screenshot says where it saved each shot, for ${IMAGE_TOOL}.`;

/** For conversations the user follows: plan with subtasks too, but stay interactive. */
export const PLAN_GUIDANCE = `## Planning the work
Before changing any files, call ${TASK_TOOL} to lay out the work as subtasks (this adds the conversation to the user's task list). Then, before starting a subtask, set it to "working"; when it's finished, set it to "done". Answering questions or reading code needs no plan.`;

export const PLAN_FIRST = `Plan first: call ${TASK_TOOL} to lay out the subtasks, or to confirm the ones given, before changing files.`;

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

// What the extension keeps of the conversation's task between calls.
type Known = { has: boolean; planned: boolean; autonomous: boolean };

const knownOf = (task: Task | null): Known => ({
  has: !!task,
  planned: !!task?.planned,
  autonomous: autonomous(task),
});

export default function tasks(pi: ExtensionAPI) {
  // Asked once, then on every run; kept current by the task tool.
  let known: Promise<Known> | null = null;
  // A composer conversation joins the list once, however many calls race.
  let joining: Promise<unknown> | null = null;
  // One wrap-up nudge per run the user started.
  let nudged = false;

  registerTaskAdd(pi);
  pi.registerTool({
    name: TASK_TOOL,
    label: "Update the task",
    description:
      "Lay out this conversation's work as subtasks (it joins the user's task list), confirm them (call with no changes), or set a subtask's status.",
    parameters: Params,
    // pi checks a parallel batch's calls before running any, so an edit beside the plan would be blocked.
    executionMode: "sequential",
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      known ??= askTask(pi, "get").then(knownOf);
      if (!(await known).has) {
        const title = firstTitle(
          ctx.sessionManager
            .getBranch()
            .flatMap((e) => (e.type === "message" ? [e.message] : [])),
        );
        const id = ctx.sessionManager.getSessionId();
        joining ??= ask(pi, {
          kind: "add",
          tasks: [conversationTask(id, title, Date.now())],
        });
        await joining;
      }
      const task = await askTask(pi, "update", {
        subtask: params.subtask,
        status: params.status,
        add: params.add,
        planned: true,
      });
      // Planned even if the task file failed, so edits never wait on it.
      known = Promise.resolve({ ...knownOf(task), planned: true });
      const text = task ? progressText(task) : "Couldn't save the subtasks.";
      return { content: [{ type: "text", text }], details: undefined };
    },
  });

  pi.on("before_agent_start", async (event) => {
    const task = await askTask(pi, "get");
    known = Promise.resolve(knownOf(task));
    // Its task deleted from the list, it joins again when it next plans.
    if (!task) joining = null;
    if (event.prompt !== WRAP_UP) nudged = false;
    const alone = autonomous(task);
    const others = pi
      .getActiveTools()
      .filter(
        (name) =>
          name !== TASK_TOOL &&
          name !== TASK_ADD_TOOL &&
          !(alone && name === ASK_TOOL),
      );
    pi.setActiveTools([
      ...others,
      TASK_TOOL,
      ...(alone ? [] : [TASK_ADD_TOOL]),
    ]);
    if (task?.declined) void askTask(pi, "update", { declined: false });
    if (!alone)
      return { systemPrompt: `${event.systemPrompt}\n\n${PLAN_GUIDANCE}` };
    const prompt = event.systemPrompt
      .replace(ASKING, AUTONOMOUS)
      .replace(COMMAND_GUIDANCE, TASK_COMMAND_GUIDANCE);
    const chrome = others.includes("chrome_navigate")
      ? `\n${CHROME_GUIDANCE}`
      : "";
    return { systemPrompt: `${prompt}\n\n${TASK_GUIDANCE}${chrome}` };
  });

  pi.on("tool_call", async (event, ctx) => {
    known ??= askTask(pi, "get").then(knownOf);
    const { has, planned } = await known;
    if (CHANGES_FILES.has(event.toolName) && !planned)
      return { block: true, reason: PLAN_FIRST };
    if (!has) return;
    const step = stepOf(event.toolName, event.input, ctx.cwd);
    if (step) void askTask(pi, "update", { step });
  });

  pi.on("agent_end", async (event) => {
    if (nudged || !(await known)?.autonomous || !endedNormally(event.messages))
      return;
    const task = await askTask(pi, "get");
    if (!task || !unfinished(task)) return;
    nudged = true;
    pi.sendUserMessage(WRAP_UP, { deliverAs: "followUp" });
  });
}
