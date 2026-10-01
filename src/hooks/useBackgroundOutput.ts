import { useCallback, useEffect, useState } from "react";
import type { BackgroundOutput } from "../../shared/agentStatus";
import type { HostClient } from "@/lib/piHost";

/** How often a running command's output is read again. */
const POLL_MS = 1000;

/**
 * A background command's output, read again every second while it runs;
 * `stop` ends it.
 */
export function useBackgroundOutput(
  host: HostClient | null,
  session: string,
  pid: number,
) {
  const [shown, setShown] = useState<BackgroundOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reads, setReads] = useState(0);

  useEffect(() => {
    if (!host) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    host
      .request({ type: "background_output", session, pid })
      .then((next) => {
        if (cancelled) return;
        setShown(next);
        setError(null);
        if (next.running) {
          timer = setTimeout(() => setReads((n) => n + 1), POLL_MS);
        }
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [host, session, pid, reads]);

  const stop = useCallback(async () => {
    await host?.request({ type: "background_stop", session, pid });
    setReads((n) => n + 1);
  }, [host, session, pid]);

  return { shown, error, stop };
}
