import { useCallback, useEffect } from "react";
import type { HostClient } from "@/lib/piHost";
import {
  applyError,
  applyEvent,
  requestApproval,
  settleApproval,
  type Transcript,
} from "@/lib/transcript";

/**
 * Applies the open session's events and approval requests to its
 * transcript. Returns the function that approves or denies a waiting call.
 */
export function useSessionEvents(
  opened: HostClient | null,
  update: (f: (t: Transcript) => Transcript) => void,
  onError: (message: string) => void,
) {
  useEffect(() => {
    if (!opened) return;
    return opened.subscribe((message) => {
      if (message.type === "session_event") {
        update((t) => applyEvent(t, message.event));
      } else if (message.type === "session_error") {
        update((t) => applyError(t, message.error));
      } else if (message.type === "approval_request") {
        update((t) => requestApproval(t, message.request));
      }
    });
  }, [opened, update]);

  return useCallback(
    (toolCallId: string, approved: boolean) => {
      if (!opened) return;
      update((t) => settleApproval(t, toolCallId));
      opened
        .send({ type: "approval_answer", toolCallId, approved })
        .catch((e: Error) => onError(e.message));
    },
    [opened, update, onError],
  );
}
