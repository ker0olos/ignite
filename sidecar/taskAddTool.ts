import { randomUUID } from "node:crypto";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { TASK_ADD_TOOL, proposedTask, type Task } from "../shared/tasks.ts";
import { APPROVAL_EVENT, type ApprovalAsk } from "./approvalExtension.ts";
import { TASK_EVENT, type TaskAsk } from "./taskExtension.ts";

export const DECLINED_ADD =
  "The user declined adding these tasks. Ask what to change if it isn't clear.";

const Params = Type.Object({
  tasks: Type.Array(
    Type.Object({
      title: Type.String({ description: "What to do, in a short line." }),
      notes: Type.Optional(
        Type.String({
          description:
            "Everything an agent needs to start it later: context, decisions, files to change, risks, links, acceptance criteria.",
        }),
      ),
      subtasks: Type.Optional(Type.Array(Type.String())),
    }),
    { minItems: 1 },
  ),
});

const approve = (pi: ExtensionAPI, toolCallId: string, signal?: AbortSignal) =>
  new Promise<{ approved: boolean; reason?: string }>((resolve) => {
    signal?.addEventListener("abort", () => resolve({ approved: false }));
    pi.events.emit(APPROVAL_EVENT, {
      request: { toolCallId, reason: "Add these to your tasks?" },
      answer: (approved, _answers, _always, reason) =>
        resolve({ approved, reason }),
    } satisfies ApprovalAsk);
  });

const add = (pi: ExtensionAPI, tasks: Task[]) =>
  new Promise<Task | null>((reply) => {
    const ask: TaskAsk = { kind: "add", tasks, reply, heard: false };
    pi.events.emit(TASK_EVENT, ask);
    if (!ask.heard) reply(null);
  });

/** task_add: proposes tasks for the folder's list, added unstarted once the user approves. */
export function registerTaskAdd(pi: ExtensionAPI) {
  pi.registerTool({
    name: TASK_ADD_TOOL,
    label: "Add tasks",
    description:
      "Add tasks to the user's task list (not started; the user starts them later). " +
      "The user sees them as cards and approves or declines before anything is added. " +
      "Use it for any plan of work for later (a feature's phases, a backlog, issues gathered from an MCP server) instead of a plan file.",
    parameters: Params,
    async execute(toolCallId, params, signal) {
      const { approved, reason } = await approve(pi, toolCallId, signal);
      if (!approved) {
        return {
          content: [{ type: "text", text: reason ?? DECLINED_ADD }],
          details: undefined,
        };
      }
      const now = Date.now();
      const tasks = params.tasks.map((p) => proposedTask(p, randomUUID(), now));
      if (!(await add(pi, tasks)))
        throw new Error("The tasks couldn't be saved.");
      const text = `Added ${tasks.length} task(s) to the list: ${tasks.map((t) => t.title).join("; ")}`;
      return { content: [{ type: "text", text }], details: undefined };
    },
  });
}
