import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTabHandoff } from "@/hooks/useTabHandoff";
import { terminalOf } from "@/lib/childTabs";
import {
  activateDocked,
  closeDocked,
  closeEverywhere,
  everyTab,
  forgetTabs,
  moveTab,
  tabOwner,
  NO_DOCKS,
  openDocked,
  renameEverywhere,
  tabsKey,
  type Dock,
  type Docks,
  type TabSets,
} from "@/lib/tabs";

/** `list`, the same array while its items stay the same. */
function useEverySame(list: string[]) {
  const joined = list.join("\n");
  return useMemo(() => (joined ? joined.split("\n") : []), [joined]);
}

/** Each conversation's open tabs, in two docks, the shown one's (`session` null before a first message, undefined while unknown) at hand. */
export function useTabs(
  folder: string | null,
  session: string | null | undefined,
) {
  const [all, setAll] = useState<TabSets>({});
  const key = folder === null ? null : tabsKey(folder, session);
  const adopt = useTabHandoff(all, setAll, folder, key);
  const latest = useRef(all);
  useEffect(() => {
    latest.current = all;
  });
  const docks = (key !== null && all[key]) || NO_DOCKS;
  const { side, bottom, focus } = docks;

  const update = useCallback(
    (change: (docks: Docks) => Docks) => {
      if (key === null) return;
      setAll((a) => ({ ...a, [key]: change(a[key] ?? NO_DOCKS) }));
    },
    [key],
  );

  const files = useMemo(
    () => [...side.files, ...bottom.files],
    [side.files, bottom.files],
  );

  return {
    files,
    /** Every conversation's terminal tabs, the same array until one opens or closes. */
    terminalTabs: useEverySame(
      [...new Set(everyTab(all).filter((t) => terminalOf(t) !== null))].sort(),
    ),
    /** Whether `tab` is open in any conversation, as of the last render. */
    isOpen: useCallback(
      (tab: string) => everyTab(latest.current).includes(tab),
      [],
    ),
    active: docks[focus].active,
    side,
    bottom,
    focus,
    open: useCallback(
      (path: string) => update((d) => openDocked(d, path)),
      [update],
    ),
    close: useCallback(
      (path: string) => update((d) => closeDocked(d, path)),
      [update],
    ),
    /** The conversation whose tabs hold `tab`, if any. */
    ownerOf: useCallback((tab: string) => tabOwner(all, tab), [all]),
    /** Renames tab `from` to `to` wherever it's open, keeping its place. */
    rename: useCallback(
      (from: string, to: string) =>
        setAll((a) => renameEverywhere(a, { [from]: to })),
      [],
    ),
    /** Closes `path` in every conversation, e.g. an ended terminal's tab. */
    closeEverywhere: useCallback(
      (path: string) => setAll((a) => closeEverywhere(a, path)),
      [],
    ),
    activate: useCallback(
      (path: string) => update((d) => activateDocked(d, path)),
      [update],
    ),
    move: useCallback(
      (path: string, to: Dock, index: number) =>
        update((d) => moveTab(d, path, to, index)),
      [update],
    ),
    /** Drops a closed conversation's tabs, or every one of a dismissed folder's. */
    forget: useCallback(
      (folder: string, session?: string) =>
        setAll((a) => forgetTabs(a, folder, session)),
      [],
    ),
    /** The conversation `session` started from the folder's first message keeps the tabs opened before it, in its worktree. */
    adopt,
  };
}
