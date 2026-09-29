import { useCallback, useRef } from "react";
import type { AgentMessage } from "../../shared/agentTypes";
import type { OpenedSession } from "../../shared/hostProtocol";
import type { HostClient } from "@/lib/piHost";

/** The conversation to show once `closing` closes: its right-hand neighbour, else its left. */
export function nextShown(open: string[], closing: string): string | null {
  const i = open.indexOf(closing);
  const rest = open.filter((s) => s !== closing);
  return rest[i] ?? rest[i - 1] ?? rest.at(-1) ?? null;
}

/**
 * Shows and closes a folder's conversations, each running on its own. A
 * conversation shows from its saved messages (`preview`) while its session
 * starts, then as it is (`put`, which also gets null: no conversation).
 * Only the last one asked for shows, however the answers race.
 */
export function useSessionSwitch({
  host,
  folder,
  put,
  preview,
  setError,
}: {
  host: HostClient | null;
  folder: string | null;
  put: (cwd: string, s: OpenedSession | null) => void;
  preview: (cwd: string, session: string, messages: AgentMessage[]) => void;
  setError: (e: string | null) => void;
}) {
  const wanted = useRef<string | null>(null);

  const reveal = useCallback(
    async (cwd: string, session: string) => {
      if (!host) return;
      wanted.current = session;
      const still = () => wanted.current === session;
      let started = false;
      setError(null);
      void host
        .request({ type: "read_session", cwd, session })
        .then((m) => still() && !started && preview(cwd, session, m))
        .catch(() => {});
      try {
        const s = await host.request({ type: "open_session", cwd, session });
        started = true;
        if (still()) put(cwd, s);
      } catch (e) {
        if (still()) setError((e as Error).message);
      }
    },
    [host, put, preview, setError],
  );

  const show = useCallback(
    (session: string) => (folder ? reveal(folder, session) : undefined),
    [folder, reveal],
  );

  // Closing the shown conversation shows a neighbour; after the last, none.
  const close = useCallback(
    async (session: string, shown: string | null, open: string[]) => {
      if (!host || !folder) return;
      await host
        .request({ type: "close_session", cwd: folder, session })
        .catch((e: Error) => setError(e.message));
      if (session !== shown) return;
      const next = nextShown(open, session);
      if (next) await show(next);
      else {
        wanted.current = null;
        put(folder, null);
      }
    },
    [host, folder, show, put, setError],
  );

  return { reveal, show, close };
}
