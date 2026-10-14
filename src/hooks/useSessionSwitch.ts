import { startTransition, useCallback, useRef } from "react";
import type { AgentMessage } from "../../shared/agentTypes";
import type { OpenedSession } from "../../shared/hostProtocol";
import type { HostClient } from "@/lib/piHost";

const PREVIEW = 40;

/** `put` as a transition, so drawing a long conversation never freezes the preview shown meanwhile. */
function later<A extends unknown[]>(put: (...a: A) => boolean, ...a: A) {
  let ok = true;
  startTransition(() => {
    ok = put(...a);
  });
  return ok;
}

/** The conversation to show once `closing` closes: its right-hand neighbour, else its left. */
export function nextShown(open: string[], closing: string): string | null {
  const i = open.indexOf(closing);
  const rest = open.filter((s) => s !== closing);
  return rest[i] ?? rest[i - 1] ?? rest.at(-1) ?? null;
}

/**
 * Shows and closes a folder's conversations, each running on its own. One the
 * app already follows shows at once (`reshow`); another shows from its saved
 * messages (`preview`) while its session starts. Then it shows as it is
 * (`put`, which also gets null: no conversation). Only the last one asked
 * for shows, however the answers race.
 */
export function useSessionSwitch({
  host,
  folder,
  put,
  preview,
  reshow,
  drop,
  setError,
}: {
  host: HostClient | null;
  folder: string | null;
  /** False when the reply left out messages the app no longer has. */
  put: (cwd: string, s: OpenedSession | null) => boolean;
  preview: (cwd: string, session: string, messages: AgentMessage[]) => void;
  reshow: (cwd: string, session: string) => boolean;
  drop: (session: string) => void;
  setError: (e: string | null) => void;
}) {
  const wanted = useRef<string | null>(null);

  /** Opens and shows a conversation (the folder's last without `session`) while `still()`; `known`: the app follows it. */
  const open = useCallback(
    async (
      cwd: string,
      still: () => boolean,
      session?: string,
      known?: string,
    ) => {
      if (!host) return;
      const s = await host.request({
        type: "open_session",
        cwd,
        session,
        known,
      });
      if (!still() || later(put, cwd, s)) return;
      // Forgotten while it opened: its messages are needed after all.
      const again = await host.request({
        type: "open_session",
        cwd,
        session: s!.session,
      });
      if (still()) later(put, cwd, again);
    },
    [host, put],
  );

  const reveal = useCallback(
    async (cwd: string, session: string) => {
      if (!host) return;
      wanted.current = session;
      const still = () => wanted.current === session;
      setError(null);
      const known = reshow(cwd, session);
      // Only its end, quick to send and draw; opening blocks the sidecar while its session starts.
      if (!known) {
        const m = await host
          .request({ type: "read_session", cwd, session, tail: PREVIEW })
          .catch(() => null);
        if (!still()) return;
        if (m) preview(cwd, session, m);
      }
      await open(cwd, still, session, known ? session : undefined).catch(
        (e: Error) => still() && setError(e.message),
      );
    },
    [host, open, preview, reshow, setError],
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
      drop(session);
      if (session !== shown) return;
      const next = nextShown(open, session);
      if (next) await show(next);
      else {
        wanted.current = null;
        put(folder, null);
      }
    },
    [host, folder, show, put, drop, setError],
  );

  return { open, reveal, show, close };
}
