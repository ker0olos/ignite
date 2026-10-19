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

/**
 * Keeps tabs with the conversation they were opened for, as its files move
 * from the folder to its worktree: the tabs opened while the folder's
 * conversation loaded go to the one it shows, and file tabs follow to the
 * worktree once it's known. Returns the handoff for a conversation the
 * folder's first message started (`workdir` its worktree).
 */
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
  const was = useRef({ key, root });
  // Each key's latest root: a move that resolves after its root changed again is dropped.
  const roots = useRef<Record<string, string>>({});

  // Only ever from the folder to a worktree; a root going back to the folder (reopening) moves nothing.
  const toWorktree = useCallback(
    async (key: string, tabs: string[], folder: string, root: string) => {
      if (root === folder) return;
      const names = await worktreeCopies(tabs, folder, root);
      if ((roots.current[key] ?? root) !== root) return;
      if (Object.keys(names).length) setAll((a) => renameTabs(a, key, names));
    },
    [setAll],
  );

  useEffect(() => {
    const before = was.current;
    was.current = { key, root };
    if (folder === null || key === null || root === null) return;
    roots.current[key] = root;
    const loading = tabsKey(folder, undefined);
    if (before.key === loading && key !== loading) {
      const tabs = tabsUnder(latest.current, loading);
      setAll((a) => handTabs(a, loading, key));
      void toWorktree(key, tabs, folder, root);
    } else if (before.key === key && before.root === folder) {
      void toWorktree(key, tabsUnder(latest.current, key), folder, root);
    }
  }, [folder, key, root, setAll, toWorktree]);

  return useCallback(
    (folder: string, session: string, workdir: string) => {
      const draft = tabsKey(folder, null);
      const started = tabsKey(folder, session);
      const tabs = tabsUnder(latest.current, draft);
      setAll((a) => handTabs(a, draft, started));
      void toWorktree(started, tabs, folder, workdir);
    },
    [setAll, toWorktree],
  );
}
