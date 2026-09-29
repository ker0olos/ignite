import { useCallback, useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { exists } from "@tauri-apps/plugin-fs";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { DEMO_FOLDER, demoProjects } from "@/lib/demo";
import { sortedByName } from "@/lib/paths";
import { stillListed, withRecent } from "@/lib/recent";
import { onStoreChange, store } from "@/lib/store";

// Only the first window restores its open folder on relaunch; extra windows start empty.
const isMainWindow = getCurrentWindow().label === "main";

/**
 * The folders the user has opened (shared by all windows, most recent first),
 * those dismissed from the sidebar (still recent), and the one this window
 * shows. In demo mode the main window lists the demo's folders, shows
 * `demoFolder`, and remembers neither.
 */
export function useFolders(demoFolder = DEMO_FOLDER) {
  const [folders, setFolders] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const dismissedRef = useRef<string[]>([]);
  // Read by handlers that fire outside React's render cycle (menu, drag and drop).
  const foldersRef = useRef<string[]>([]);

  const show = useCallback((next: string[]) => {
    foldersRef.current = next;
    setFolders(next);
    setCurrent((c) => stillListed(c, next));
  }, []);

  const save = useCallback(
    (next: string[]) => {
      show(next);
      store.then((s) => s.set("folders", next));
    },
    [show],
  );

  const saveDismissed = useCallback((next: string[]) => {
    dismissedRef.current = next;
    setDismissed(next);
    store.then((s) => s.set("dismissed", next));
  }, []);

  // Opening a folder in any way brings it back to the sidebar.
  const addFolder = useCallback(
    (path: string) => {
      save(withRecent(foldersRef.current, path));
      if (dismissedRef.current.includes(path)) {
        saveDismissed(dismissedRef.current.filter((p) => p !== path));
      }
      setCurrent(path);
    },
    [save, saveDismissed],
  );

  /** Takes a folder off the sidebar; it stays recent. The shown one gives way to the first left. */
  const dismissFolder = useCallback(
    (path: string) => {
      const next = [...dismissedRef.current.filter((p) => p !== path), path];
      saveDismissed(next);
      const left = foldersRef.current.filter((p) => !next.includes(p));
      setCurrent((c) => (c === path ? (sortedByName(left)[0] ?? null) : c));
    },
    [saveDismissed],
  );

  const openFolder = useCallback(async () => {
    const path = await open({ directory: true });
    if (path) addFolder(path);
  }, [addFolder]);

  /** Stops showing a folder; it stays listed, with its conversations. */
  const closeFolder = useCallback(() => setCurrent(null), []);
  const clearFolders = useCallback(() => {
    save([]);
    saveDismissed([]);
  }, [save, saveDismissed]);

  useEffect(() => {
    store.then(async (s) => {
      show(
        demoFolder
          ? demoProjects(demoFolder)
          : ((await s.get<string[]>("folders")) ?? []),
      );
      if (!demoFolder) {
        const hidden = (await s.get<string[]>("dismissed")) ?? [];
        dismissedRef.current = hidden;
        setDismissed(hidden);
      }
      if (isMainWindow) {
        const saved = await s.get<string>("current");
        // A folder moved or deleted since last time isn't reopened.
        const restored =
          demoFolder ?? (saved && (await exists(saved)) ? saved : null);
        setCurrent(restored ?? null);
      }
      setLoaded(true);
    });
    const unlisten = onStoreChange((key, value) => {
      if (key === "folders") show((value as string[] | undefined) ?? []);
      if (key === "dismissed") {
        dismissedRef.current = (value as string[] | undefined) ?? [];
        setDismissed(dismissedRef.current);
      }
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, [show, demoFolder]);

  useEffect(() => {
    // The demo folder isn't remembered, so the next normal launch is unaffected.
    if (loaded && isMainWindow && !demoFolder) {
      store.then((s) => s.set("current", current));
    }
  }, [loaded, current, demoFolder]);

  return {
    loaded,
    folders,
    /** The folders the sidebar lists: recent ones not dismissed. */
    shownFolders: folders.filter((p) => !dismissed.includes(p)),
    current,
    addFolder,
    dismissFolder,
    openFolder,
    closeFolder,
    clearFolders,
  };
}
