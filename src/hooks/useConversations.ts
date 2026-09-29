import { useCallback } from "react";
import type { SavedSession } from "../../shared/hostProtocol";
import type { HostClient } from "@/lib/piHost";

/** What the shown folder's session hook offers for its own conversations. */
type Shown = {
  show: (session: string, cwd: string) => unknown;
  create: (cwd: string) => void;
  close: (session: string, open: string[]) => Promise<void>;
};

/**
 * Every folder's conversations, as the sidebar lists them, through the shown
 * folder's session hook: picking one in another folder selects that folder
 * at once, which then shows it.
 */
export function useConversations(
  host: HostClient | null,
  current: string | null,
  shown: Shown,
  folders: {
    select: (folder: string) => void;
    /** Takes a folder off the sidebar. */
    dismiss: (folder: string) => void;
    /** Takes a closed conversation off its folder's list. */
    forget: (folder: string, session: string) => void;
  },
) {
  const { select, dismiss: hide, forget } = folders;
  const show = useCallback(
    (cwd: string, session: string) => {
      shown.show(session, cwd);
      if (cwd !== current) select(cwd);
    },
    [current, shown, select],
  );

  // Only an empty conversation to write in; its first message starts it.
  const create = useCallback(
    (cwd: string) => {
      shown.create(cwd);
      if (cwd !== current) select(cwd);
    },
    [current, shown, select],
  );

  const close = useCallback(
    async (cwd: string, session: string, open: string[]) => {
      forget(cwd, session);
      if (cwd === current) return shown.close(session, open);
      await host
        ?.request({ type: "close_session", cwd, session })
        .catch(() => {});
    },
    [host, current, shown, forget],
  );

  // Nothing hidden keeps working or waits on the user; its conversations
  // stay saved and listed, for when it comes back.
  /** Takes a folder off the sidebar, ending its conversations. */
  const dismiss = useCallback(
    (cwd: string) => {
      hide(cwd);
      void host?.request({ type: "close_session", cwd }).catch(() => {});
    },
    [host, hide],
  );

  const history = useCallback(
    async (cwd: string): Promise<SavedSession[]> => {
      if (!host) return [];
      const saved = await host.request({ type: "list_sessions", cwd });
      return saved.filter((s) => !s.open);
    },
    [host],
  );

  return { show, create, close, dismiss, history };
}

/** The sidebar's conversation actions, per folder. */
export type Conversations = ReturnType<typeof useConversations>;
