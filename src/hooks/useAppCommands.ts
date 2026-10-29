import { useCallback, useMemo } from "react";
import type { OpenedSession } from "../../shared/hostProtocol";
import type { ImageContent } from "../../shared/agentTypes";
import type { HostClient } from "@/lib/piHost";
import { useCompact } from "@/hooks/useCompact";
import { useFork } from "@/hooks/useFork";
import { useRename } from "@/hooks/useRename";
import { appCommand } from "@/lib/mentions";

/** The app's `/compact`, `/fork` and `/rename` on the shown conversation; `run` is undefined for text that's none of them. */
export function useAppCommands(
  opened: HostClient | null,
  folder: string | null,
  none: boolean,
  session: string | null,
  start: (s: OpenedSession) => void,
  setError: (e: string | null) => void,
) {
  const compact = useCompact(opened, none, session, setError);
  const fork = useFork(opened, folder, none ? null : session, start, setError);
  const rename = useRename(opened, none, session, setError);
  const run = useCallback(
    (text: string, images: ImageContent[]) => {
      const instructions = appCommand("compact", text);
      if (instructions !== null) return compact(instructions);
      const task = appCommand("fork", text);
      if (task !== null) return fork(task, images);
      const title = appCommand("rename", text);
      if (title !== null) return rename(title);
    },
    [compact, fork, rename],
  );
  return useMemo(() => ({ compact, fork, run }), [compact, fork, run]);
}
