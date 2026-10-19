import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import { worktreeCopy } from "@/lib/files";
import {
  handTabs,
  renameTabs,
  tabsKey,
  tabsUnder,
  type TabSets,
} from "@/lib/tabs";

/** The worktree copies (under `root`) of the files under `folder` among `tabs`; one the worktree lacks keeps its path. */
async function worktreeCopies(tabs: string[], folder: string, root: string) {
  const pairs = await Promise.all(
    tabs.map(async (t) => {
      const there = await worktreeCopy(t, folder, root);
      return there ? [[t, there] as const] : [];
    }),
  );
  return Object.fromEntries(pairs.flat());
}

/** Hands tabs opened while the folder's conversation was unknown (the folder showed) to the one it shows; returns the handoff for one a first message started. */
export function useTabHandoff(
  all: TabSets,
  setAll: Dispatch<SetStateAction<TabSets>>,
  folder: string | null,
  key: string | null,
  root: string | null,
) {
  const latest = useRef(all);
  useEffect(() => {
    latest.current = all;
  });
  const was = useRef(key);

  // Renames `key`'s tabs among `tabs` to their copies in worktree `root`; returns those it has none of yet.
  const toWorktree = useCallback(
    async (key: string, tabs: string[], folder: string, root: string) => {
      const names = await worktreeCopies(tabs, folder, root);
      if (Object.keys(names).length) setAll((a) => renameTabs(a, key, names));
      return tabs.filter((t) => !(t in names));
    },
    [setAll],
  );

  useEffect(() => {
    const before = was.current;
    was.current = key;
    if (folder === null || key === null) return;
    const loading = tabsKey(folder, undefined);
    if (before !== loading || key === loading) return;
    const tabs = tabsUnder(latest.current, loading);
    setAll((a) => handTabs(a, loading, key));
    // Its files, opened from the folder, switch to the worktree's copies once known.
    if (root && root !== folder) void toWorktree(key, tabs, folder, root);
  }, [folder, key, root, setAll, toWorktree]);

  // The tabs opened before the first message (the folder's files) go to the conversation it started, in its worktree;
  // ignored files (.env, builds) are looked for again once `ready` (they're copied in after it starts).
  return useCallback(
    (
      folder: string,
      session: string,
      workdir: string,
      ready?: Promise<unknown>,
    ) => {
      const draft = tabsKey(folder, null);
      const started = tabsKey(folder, session);
      const tabs = tabsUnder(latest.current, draft);
      setAll((a) => handTabs(a, draft, started));
      if (workdir === folder) return;
      void toWorktree(started, tabs, folder, workdir).then(async (left) => {
        if (left.length && ready)
          await ready.then(() => toWorktree(started, left, folder, workdir));
      });
    },
    [setAll, toWorktree],
  );
}
