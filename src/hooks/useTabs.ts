import { useCallback, useState } from "react";
import { closeTab, openTab, type Tabs } from "@/lib/tabs";

const NO_TABS: Tabs = { files: [], active: null };

/**
 * Open file tabs for `folder`. Switching folders starts with no tabs; the
 * previous folder's tabs are dropped, not restored.
 */
export function useTabs(folder: string | null) {
  const [state, setState] = useState({ folder, ...NO_TABS });
  const tabs: Tabs = state.folder === folder ? state : NO_TABS;

  const update = useCallback(
    (change: (tabs: Tabs) => Tabs) =>
      setState((s) => ({
        folder,
        ...change(s.folder === folder ? s : NO_TABS),
      })),
    [folder],
  );

  return {
    files: tabs.files,
    active: tabs.active,
    open: useCallback(
      (path: string) => update((t) => openTab(t, path)),
      [update],
    ),
    close: useCallback(
      (path: string) => update((t) => closeTab(t, path)),
      [update],
    ),
    activate: useCallback(
      (path: string) => update((t) => ({ ...t, active: path })),
      [update],
    ),
  };
}
