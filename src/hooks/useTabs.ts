import { useCallback, useMemo, useState } from "react";
import {
  activateDocked,
  closeDocked,
  moveTab,
  NO_DOCKS,
  openDocked,
  type Dock,
  type Docks,
} from "@/lib/tabs";

/**
 * Open tabs for `folder`, beside the conversation or docked under it. `files`
 * and `active` span both docks (`active` is the focused dock's). Switching
 * folders starts with no tabs; the previous folder's tabs are dropped, not restored.
 */
export function useTabs(folder: string | null) {
  const [state, setState] = useState({ folder, ...NO_DOCKS });
  const docks: Docks = state.folder === folder ? state : NO_DOCKS;
  const { side, bottom, focus } = docks;

  const update = useCallback(
    (change: (docks: Docks) => Docks) =>
      setState((s) => ({
        folder,
        ...change(s.folder === folder ? s : NO_DOCKS),
      })),
    [folder],
  );

  const files = useMemo(
    () => [...side.files, ...bottom.files],
    [side.files, bottom.files],
  );

  return {
    files,
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
    activate: useCallback(
      (path: string) => update((d) => activateDocked(d, path)),
      [update],
    ),
    move: useCallback(
      (path: string, to: Dock, index: number) =>
        update((d) => moveTab(d, path, to, index)),
      [update],
    ),
  };
}
