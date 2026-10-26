import { useCallback } from "react";
import type { HostClient } from "@/lib/piHost";

/** Cutting the shown conversation's waits short: a bash call's, or its wait for its forks; each false when refused, its reason shown. */
export function useWaitSkips(
  opened: HostClient | null,
  shown: string | null,
  setError: (message: string) => void,
) {
  const skipWait = useCallback(
    async (toolCallId: string) =>
      !!opened &&
      opened
        .request({ type: "skip_wait", toolCallId })
        .catch((e: Error) => (setError(e.message), false)),
    [opened, setError],
  );
  const stopForkWait = useCallback(
    async () =>
      !!opened &&
      !!shown &&
      opened
        .request({ type: "stop_fork_wait", session: shown })
        .catch((e: Error) => (setError(e.message), false)),
    [opened, shown, setError],
  );
  return { skipWait, stopForkWait };
}
