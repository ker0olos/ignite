import { useCallback } from "react";
import type { OpenedSession } from "../../shared/hostProtocol";
import type { ImageContent } from "../../shared/agentTypes";
import type { HostClient } from "@/lib/piHost";

/** `/fork` and the sidebar's fork button: copies the shown conversation into a new one, shows it, then sends it `task` (if any). */
export function useFork(
  opened: HostClient | null,
  folder: string | null,
  session: string | null,
  start: (s: OpenedSession) => void,
  setError: (e: string | null) => void,
) {
  return useCallback(
    async (task: string, images: ImageContent[]) => {
      if (!opened || !folder) return;
      if (!session) return setError("There's nothing to fork yet.");
      setError(null);
      try {
        const s = await opened.request({
          type: "new_session",
          cwd: folder,
          fork: { session, ...(task && { task }) },
        });
        start(s);
        if (!task && !images.length) return;
        await opened.request({
          type: "prompt",
          text: task,
          session: s.session,
          ...(images.length > 0 && { images }),
        });
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [opened, folder, session, start, setError],
  );
}
