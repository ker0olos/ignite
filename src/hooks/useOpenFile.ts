import { useCallback, useEffect, useRef } from "react";

/** A tab id, or one made from the shown conversation's root (its worktree, else the folder). */
type Tab = string | ((root: string) => string | Promise<string>);

/**
 * `from`: the folder and conversation shown when it was asked for; `reached`:
 * its folder has shown since.
 */
type Pending = {
  folder: string;
  tab: Tab;
  session?: string;
  from: { folder: string | null; session: string | null };
  reached?: boolean;
};

/** Opens a tab in any folder, or with `session` in that conversation, once it shows; dropped if the user moves on first. */
export function useOpenFile(
  current: string | null,
  shown: { session: string | null; root: string | null },
  openTab: (tab: string) => void,
  select: (folder: string) => void,
) {
  const pending = useRef<Pending | null>(null);
  const { session, root } = shown;

  const ready = useCallback(
    (p: Pending) =>
      p.folder === current &&
      root !== null &&
      (p.session === undefined || p.session === session),
    [current, root, session],
  );
  // Moved on: left its folder once there, or (asked from that folder) showed yet another conversation there.
  // Another folder first shows its last conversation, so only leaving it counts.
  const passed = useCallback(
    (p: Pending) => {
      if (p.folder !== current) return !!p.reached;
      return (
        p.session !== undefined &&
        p.from.folder === current &&
        session !== null &&
        session !== p.session &&
        session !== p.from.session
      );
    },
    [current, session],
  );

  const openNow = useCallback(
    (tab: Tab) => {
      if (typeof tab === "string") return openTab(tab);
      void Promise.resolve(tab(root!)).then(openTab);
    },
    [root, openTab],
  );

  useEffect(() => {
    const waiting = pending.current;
    if (!waiting || passed(waiting)) {
      pending.current = null;
      return;
    }
    if (waiting.folder === current) waiting.reached = true;
    if (!ready(waiting)) return;
    pending.current = null;
    openNow(waiting.tab);
  }, [current, ready, passed, openNow]);

  return useCallback(
    (folder: string, tab: Tab, target?: string) => {
      const from = { folder: current, session };
      const p: Pending = { folder, tab, session: target, from };
      if (ready(p)) return openNow(tab);
      pending.current = p;
      if (folder !== current) select(folder);
    },
    [current, session, ready, openNow, select],
  );
}
