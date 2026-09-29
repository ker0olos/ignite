import { useCallback, useEffect } from "react";
import type { QuestionAnswer } from "../../shared/questions";
import type { HostClient } from "@/lib/piHost";
import {
  applyError,
  applyEvent,
  requestApproval,
  settleApproval,
  type Transcript,
} from "@/lib/transcript";

/**
 * Applies the shown session's events and approval requests to its
 * transcript, ignoring those of the folder's other conversations. Returns the
 * function that approves or denies a waiting call, or answers its questions.
 */
export function useSessionEvents(
  opened: HostClient | null,
  /** The shown conversation, read as each event arrives. */
  session: { readonly current: string | null },
  update: (f: (t: Transcript) => Transcript) => void,
  onError: (message: string) => void,
) {
  useEffect(() => {
    if (!opened) return;
    return opened.subscribe((message) => {
      if ("session" in message && message.session !== session.current) return;
      if (message.type === "session_event") {
        update((t) => applyEvent(t, message.event));
      } else if (message.type === "session_error") {
        update((t) => applyError(t, message.error));
      } else if (message.type === "approval_request") {
        update((t) => requestApproval(t, message.request));
      }
    });
  }, [opened, session, update]);

  return useCallback(
    (toolCallId: string, approved: boolean, answers?: QuestionAnswer[]) => {
      if (!opened) return;
      update((t) => settleApproval(t, toolCallId));
      opened
        .send({ type: "approval_answer", toolCallId, approved, answers })
        .catch((e: Error) => onError(e.message));
    },
    [opened, update, onError],
  );
}
