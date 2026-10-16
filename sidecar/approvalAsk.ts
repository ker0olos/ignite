/** The channel tool calls wait on the user through: pi's event bus to the host (hostApproval.ts). */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ApprovalRequest } from "../shared/hostProtocol.ts";
import type { QuestionAnswer } from "../shared/questions.ts";
import type { Wait } from "./waitingCalls.ts";

/** pi event bus channel carrying an ApprovalAsk to the host. */
export const APPROVAL_EVENT = "app/approval";

/** An approval question on the event bus; `answer` settles it. */
export type ApprovalAsk = {
  request: ApprovalRequest;
  /** `always`: the user also allowed the request's `allow` from now on; `reason`: what the model is told in place of the tool's own denial. */
  answer(
    approved: boolean,
    answers?: QuestionAnswer[],
    always?: boolean,
    reason?: string,
  ): void;
  /** Called when the user declined it, not when a stop, close or message denied it. */
  declined?(): void;
  /** When it waits; a tool asking for itself leaves it out ("asking"). */
  wait?: Wait;
};

/** Asks the user about `request`; stopping the run (`signal`) denies it. */
export const askUser = (
  pi: ExtensionAPI,
  request: ApprovalRequest,
  signal: AbortSignal | undefined,
  wait: Wait,
) =>
  new Promise<{ approved: boolean; always?: boolean; reason?: string }>(
    (resolve) => {
      signal?.addEventListener("abort", () => resolve({ approved: false }));
      pi.events.emit(APPROVAL_EVENT, {
        request,
        answer: (approved, _answers, always, reason) =>
          resolve({ approved, always, reason }),
        wait,
      } satisfies ApprovalAsk);
    },
  );
