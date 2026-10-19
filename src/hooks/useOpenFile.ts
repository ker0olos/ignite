import { useCallback, useEffect, useRef } from "react";

/** A tab id, or one made from the shown conversation's root (its worktree, else the folder). */
type Tab = string | ((root: string) => string | Promise<string>);

/** `from`: the conversation shown when it was asked for, which may still show while `session` opens. */
type Pending = {
  folder: string;
  tab: Tab;
  session?: string;
  from: string | null;
};

/**
 * Opens a tab of any folder (a file path, a diff, a subagent…): another
 * folder, or with `session` another conversation, is shown first, and the tab
 * opens once it shows, joining that conversation's tabs. Showing yet another
 * conversation meanwhile drops it.
 */
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
  const passed = useCallback(
    (p: Pending) =>
      p.session !== undefined &&
      p.folder === current &&
      session !== null &&
      session !== p.session &&
      session !== p.from,
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
    if (!ready(waiting)) return;
    pending.current = null;
    openNow(waiting.tab);
  }, [ready, passed, openNow]);

  return useCallback(
    (folder: string, tab: Tab, target?: string) => {
      const p = { folder, tab, session: target, from: session };
      if (ready(p)) return openNow(tab);
      pending.current = p;
      if (folder !== current) select(folder);
    },
    [current, session, ready, openNow, select],
  );
}
