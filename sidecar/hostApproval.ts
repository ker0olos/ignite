import type { ApprovalAsk } from "./approvalExtension.ts";
import type { HostContext } from "./hostTypes.ts";

/** Passes a tool call's approval question on to the app. */
export function askApproval(ctx: HostContext, ask: ApprovalAsk) {
  ctx.approvals.set(ask.request.toolCallId, ask.answer);
  ctx.send({ type: "approval_request", request: ask.request });
}

/** Settles a waiting tool call with the user's answer. */
export function answerApproval(
  ctx: HostContext,
  toolCallId: string,
  approved: boolean,
) {
  ctx.approvals.get(toolCallId)?.(approved);
  ctx.approvals.delete(toolCallId);
}

/** Denies every waiting tool call: the run stopped or the session closed. */
export function denyAll(ctx: HostContext) {
  ctx.approvals.forEach((answer) => answer(false));
  ctx.approvals.clear();
}
