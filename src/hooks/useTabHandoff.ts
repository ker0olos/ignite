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

/** Hands tabs opened while the folder's conversation was unknown to the one it shows; returns the handoff for one a first message started. */
export function useTabHandoff(
  all: TabSets,
  setAll: Dispatch<SetStateAction<TabSets>>,
  folder: string | null,
  key: string | null,
) {
  const latest = useRef(all);
  useEffect(() => {
    latest.current = all;
  });
  const was = useRef(key);

  useEffect(() => {
    const before = was.current;
    was.current = key;
    if (folder === null || key === null) return;
    const loading = tabsKey(folder, undefined);
    if (before === loading && key !== loading)
      setAll((a) => handTabs(a, loading, key));
  }, [folder, key, setAll]);

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
      const toWorktree = async (left: string[]) => {
        const names = await worktreeCopies(left, folder, workdir);
        if (Object.keys(names).length)
          setAll((a) => renameTabs(a, started, names));
        return left.filter((t) => !(t in names));
      };
      void toWorktree(tabs).then(async (left) => {
        if (left.length && ready) await ready.then(() => toWorktree(left));
      });
    },
    [setAll],
  );
}
