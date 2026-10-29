import { useCallback } from "react";
import type { HostClient } from "@/lib/piHost";

/** `/rename`: names the shown conversation `title`, or without one has the model title it. */
export function useRename(
  opened: HostClient | null,
  none: boolean,
  session: string | null,
  setError: (e: string | null) => void,
) {
  return useCallback(
    async (title: string) => {
      if (!opened) return;
      if (none) return setError("There's nothing to rename yet.");
      setError(null);
      try {
        await opened.request({
          type: "rename",
          ...(session && { session }),
          ...(title && { title }),
        });
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [opened, none, session, setError],
  );
}
