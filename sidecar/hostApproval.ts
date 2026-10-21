import type { QuestionAnswer } from "../shared/questions.ts";
import type { ApprovalAsk } from "./approvalAsk.ts";
import { tellsApp, type Agent, type HostContext } from "./hostTypes.ts";
import { pushProjects } from "./hostProjects.ts";
import { forgetWaiting, markWaiting, unmarkWaiting } from "./waitingCalls.ts";

/** Keeps a tool call's question, and passes it on if the app follows its conversation. */
export function askApproval(ctx: HostContext, agent: Agent, ask: ApprovalAsk) {
  const id = ask.request.toolCallId;
  agent.approvals.set(id, ask);
  if (own(agent, id)) markWaiting(agent.id, id, ask.wait ?? "asking");
  if (tellsApp(ctx, agent)) {
    ctx.send({
      type: "approval_request",
      session: agent.id,
      request: ask.request,
    });
  }
  pushProjects(ctx);
}

/** Settles a waiting tool call with the user's answer. */
export function answerApproval(
  ctx: HostContext,
  toolCallId: string,
  approved: boolean,
  answers?: QuestionAnswer[],
  always?: boolean,
) {
  for (const agent of ctx.agents.values()) {
    const ask = agent.approvals.get(toolCallId);
    if (!ask) continue;
    agent.approvals.delete(toolCallId);
    unmarkWaiting(agent.id, toolCallId);
    if (!approved) ask.declined?.();
    ask.answer(approved, answers, always);
    pushProjects(ctx);
  }
}

export const WROTE_INSTEAD =
  "The user didn't let this run: they wrote to you instead, and their message follows. Read it before going on.";

// pi lists a call as running before it asks, so a waiting call it doesn't list is a subagent's.
const own = (agent: Agent, toolCallId: string) =>
  agent.toolRuns.has(toolCallId);

/** Whether the conversation's own run (not a subagent) waits on the user. */
export const waitsOnUser = (agent: Agent) =>
  [...agent.approvals.keys()].some((id) => own(agent, id));

/** Denies a conversation's waiting tool calls: its run stopped, it closed, or the user `wrote` a message instead. */
export function denyAll(ctx: HostContext, agent: Agent, wrote = false) {
  if (!agent.approvals.size) return;
  agent.approvals.forEach((ask, id) => {
    const instead = wrote && own(agent, id);
    ask.answer(
      false,
      undefined,
      undefined,
      instead ? WROTE_INSTEAD : undefined,
    );
  });
  agent.approvals.clear();
  forgetWaiting(agent.id);
  pushProjects(ctx);
}
