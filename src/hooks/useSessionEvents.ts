import { useCallback, useEffect } from "react";
import type { SessionState } from "../../shared/hostProtocol";
import type { QuestionAnswer } from "../../shared/questions";
import type { HostClient } from "@/lib/piHost";
import {
  applyError,
  applyEvent,
  approvalAway,
  requestApproval,
  settleApproval,
  type Transcript,
} from "@/lib/transcript";

/**
 * Applies every followed conversation's events and approval requests to its
 * own transcript, so each one is current when it shows. Returns the function
 * that approves or denies a waiting call of the shown one, or answers its
 * questions.
 */
export function useSessionEvents(
  host: HostClient | null,
  /** The shown conversation, read when answering. */
  shownNow: () => string | null,
  apply: (session: string, f: (t: Transcript) => Transcript) => void,
  onError: (message: string) => void,
  setState: (state: SessionState, session: string) => void,
) {
  useEffect(() => {
    if (!host) return;
    return host.subscribe((message) => {
      if (message.type === "session_event") {
        apply(message.session, (t) => applyEvent(t, message.event));
        // The router may have switched the model and effort.
        if (message.event.type === "routing_end") {
          const routed = message.session;
          host
            .request({ type: "session_state", session: routed })
            .then((state) => setState(state, routed))
            .catch((e: Error) => onError(e.message));
        }
      } else if (message.type === "session_error") {
        apply(message.session, (t) => applyError(t, message.error));
      } else if (message.type === "approval_request") {
        apply(message.session, (t) => requestApproval(t, message.request));
      } else if (message.type === "approval_away") {
        const { toolCallId, awayAt } = message.request;
        apply(message.session, (t) => approvalAway(t, toolCallId, awayAt));
      }
    });
  }, [host, apply, onError, setState]);

  return useCallback(
    (
      toolCallId: string,
      approved: boolean,
      answers?: QuestionAnswer[],
      always?: boolean,
    ) => {
      const shown = shownNow();
      if (!host || !shown) return;
      apply(shown, (t) => settleApproval(t, toolCallId));
      host
        .send({
          type: "approval_answer",
          toolCallId,
          approved,
          answers,
          always,
        })
        .catch((e: Error) => onError(e.message));
    },
    [host, shownNow, apply, onError],
  );
}
