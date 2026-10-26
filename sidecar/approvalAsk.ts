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
  /** Unanswered this long once first in line, it's answered as the user being away (awayTimer.ts). */
  away?: Away;
};

/** What a call does when nobody answers it: after `afterMs`, it's denied with `reason`, given the user's unsent answers to its questions. */
export type Away = {
  afterMs: number;
  reason(draft?: QuestionAnswer[]): string;
};

type Answer = {
  approved: boolean;
  always?: boolean;
  reason?: string;
  /** Only when the user answered no, not on a stop, close or message. */
  declined?: boolean;
};

/** Asks the user about `request`; stopping the run (`signal`) denies it. */
export const askUser = (
  pi: Pick<ExtensionAPI, "events">,
  request: ApprovalRequest,
  signal: AbortSignal | undefined,
  wait?: Wait,
  away?: Away,
) =>
  new Promise<Answer>((resolve) => {
    if (signal?.aborted) return resolve({ approved: false });
    const stop = () => resolve({ approved: false });
    signal?.addEventListener("abort", stop, { once: true });
    // The host calls `declined` just before `answer`.
    let declined = false;
    pi.events.emit(APPROVAL_EVENT, {
      request,
      answer: (approved, _answers, always, reason) => {
        signal?.removeEventListener("abort", stop);
        resolve({ approved, always, reason, declined });
      },
      declined: () => (declined = true),
      wait,
      away,
    } satisfies ApprovalAsk);
  });
