import { useEffect, useState } from "react";
import type { HostClient } from "@/lib/piHost";

/** Whether conversation `session` waits for a fork (one is open, or its report is being written), from the sidecar's status pushes. */
export function useForkWait(host: HostClient | null, session: string | null) {
  const [waiting, setWaiting] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (!host) return;
    return host.subscribe((message) => {
      if (message.type !== "agents") return;
      setWaiting(
        new Set(
          message.agents.filter((a) => a.waitingOnFork).map((a) => a.session),
        ),
      );
    });
  }, [host]);

  return !!session && waiting.has(session);
}
