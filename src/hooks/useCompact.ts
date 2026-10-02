import { useCallback } from "react";
import type { HostClient } from "@/lib/piHost";

/** Compacts the shown conversation (`/compact`); its progress shows through compaction events. */
export function useCompact(
  opened: HostClient | null,
  none: boolean,
  session: string | null,
  setError: (e: string | null) => void,
) {
  return useCallback(
    async (instructions: string) => {
      if (!opened) return;
      if (none) return setError("There's nothing to compact yet.");
      setError(null);
      try {
        await opened.request({
          type: "compact",
          ...(session && { session }),
          ...(instructions && { instructions }),
        });
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [opened, none, session, setError],
  );
}
