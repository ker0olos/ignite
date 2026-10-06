import type { HostRequest } from "../shared/hostProtocol.ts";
import { answerApproval } from "./hostApproval.ts";
import type { HostContext } from "./hostTypes.ts";

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
  } else {
    const { toolCallId, approved, answers, always } = request;
    answerApproval(ctx, toolCallId, approved, answers, always);
  }
  return true;
}
