import type { QuestionAnswer } from "../shared/questions.ts";
import type { ApprovalAsk } from "./approvalExtension.ts";
import { isShown, type Agent, type HostContext } from "./hostTypes.ts";
import { pushProjects } from "./hostProjects.ts";

/** Keeps a tool call's question, and passes it on if its conversation is shown. */
export function askApproval(ctx: HostContext, agent: Agent, ask: ApprovalAsk) {
  agent.approvals.set(ask.request.toolCallId, ask);
  if (isShown(ctx, agent)) {
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
    if (!approved) ask.declined?.();
    ask.answer(approved, answers, always);
    pushProjects(ctx);
  }
}

/** Denies a conversation's waiting tool calls: its run stopped or it closed. */
export function denyAll(ctx: HostContext, agent: Agent) {
  if (!agent.approvals.size) return;
  agent.approvals.forEach((ask) => ask.answer(false));
  agent.approvals.clear();
  pushProjects(ctx);
}
