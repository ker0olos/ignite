import { useCallback, useEffect, useRef } from "react";

/**
 * Opens a tab of any folder (a file path, a diff, a subagent…): another
 * folder is selected first, and the tab opens once it shows.
 */
export function useOpenFile(
  current: string | null,
  openTab: (tab: string) => void,
  select: (folder: string) => void,
) {
  const pending = useRef<{ folder: string; tab: string } | null>(null);

  useEffect(() => {
    const waiting = pending.current;
    if (!waiting || waiting.folder !== current) return;
    pending.current = null;
    openTab(waiting.tab);
  }, [current, openTab]);

  return useCallback(
    (folder: string, tab: string) => {
      if (folder === current) return openTab(tab);
      pending.current = { folder, tab };
      select(folder);
    },
    [current, openTab, select],
  );
}
