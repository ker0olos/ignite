import type { HostRequest } from "../shared/hostProtocol.ts";
import { userBack } from "./awayTimer.ts";
import { answerApproval, keepAnswers } from "./hostApproval.ts";
import { shown, type HostContext } from "./hostTypes.ts";

type Answer = Exclude<HostRequest, { id: number }>;

/** Applies a request that gets no response (the user answering something); false for any other. */
export function answered(
  ctx: HostContext,
  request: HostRequest,
): request is Answer {
  if ("id" in request) return false;
  if (request.type === "prompt_answer") {
    ctx.prompts.get(request.promptId)?.resolve(request.value);
  } else if (request.type === "prompt_cancel") {
    ctx.prompts.get(request.promptId)?.reject(new Error("Cancelled"));
  } else if (request.type === "approval_answer") {
    const { toolCallId, approved, answers, always } = request;
    answerApproval(ctx, toolCallId, approved, answers, always);
  } else if (request.type === "question_draft") {
    keepAnswers(ctx, request.toolCallId, request.answers);
  } else if (request.type === "user_active") {
    const looking = shown(ctx);
    ctx.agents.forEach((agent) => userBack(agent, agent === looking));
  }
  return true;
}
