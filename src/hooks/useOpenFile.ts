import { useCallback, useEffect, useRef } from "react";

/**
 * Opens a file of any folder in a tab: another folder is selected first, and
 * the tab opens once it shows.
 */
export function useOpenFile(
  current: string | null,
  openTab: (path: string) => void,
  select: (folder: string) => void,
) {
  const pending = useRef<string | null>(null);

  useEffect(() => {
    const path = pending.current;
    if (!path || !current || !path.startsWith(`${current}/`)) return;
    pending.current = null;
    openTab(path);
  }, [current, openTab]);

  return useCallback(
    (folder: string, relative: string) => {
      const path = `${folder}/${relative}`;
      if (folder === current) return openTab(path);
      pending.current = path;
      select(folder);
    },
    [current, openTab, select],
  );
}
