import { useCallback, useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { DEMO_FOLDER } from "@/lib/demo";
import { stillListed, withRecent } from "@/lib/recent";
import { onStoreChange, store } from "@/lib/store";

// Only the first window restores its open folder on relaunch; extra windows start empty.
const isMainWindow = getCurrentWindow().label === "main";

/**
 * Recently opened folders (shared by all windows, most recent first), the
 * projects open in this window and the one it shows. In demo mode the main window opens
 * `demoFolder` and doesn't remember it.
 */
export function useFolders(demoFolder = DEMO_FOLDER) {
  const [folders, setFolders] = useState<string[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [projects, setProjects] = useState<string[]>([]);
  const currentRef = useRef(current);
  const projectsRef = useRef(projects);
  useEffect(() => {
    currentRef.current = current;
    projectsRef.current = projects;
  }, [current, projects]);
  const [loaded, setLoaded] = useState(false);
  // Read by handlers that fire outside React's render cycle (menu, drag and drop).
  const foldersRef = useRef<string[]>([]);

  const show = useCallback((next: string[]) => {
    foldersRef.current = next;
    setFolders(next);
    setCurrent((c) => stillListed(c, next));
    setProjects((o) => o.filter((p) => next.includes(p)));
  }, []);

  const save = useCallback(
    (next: string[]) => {
      show(next);
      store.then((s) => s.set("folders", next));
    },
    [show],
  );

  const addFolder = useCallback(
    (path: string) => {
      save(withRecent(foldersRef.current, path));
      setProjects((o) => (o.includes(path) ? o : [...o, path]));
      setCurrent(path);
    },
    [save],
  );

  const openFolder = useCallback(async () => {
    const path = await open({ directory: true });
    if (path) addFolder(path);
  }, [addFolder]);

  /** Closes a project, by default the shown one, which gives way to the last one opened. */
  const closeFolder = useCallback((path = currentRef.current) => {
    const rest = projectsRef.current.filter((p) => p !== path);
    setProjects(rest);
    setCurrent((c) => (c === path ? (rest.at(-1) ?? null) : c));
  }, []);
  const clearFolders = useCallback(() => save([]), [save]);

  useEffect(() => {
    store.then(async (s) => {
      show((await s.get<string[]>("folders")) ?? []);
      if (isMainWindow) {
        const restored = demoFolder ?? (await s.get<string>("current"));
        setCurrent(restored ?? null);
        setProjects(restored ? [restored] : []);
      }
      setLoaded(true);
    });
    const unlisten = onStoreChange((key, value) => {
      if (key === "folders") show((value as string[] | undefined) ?? []);
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
    /** Projects open in this window, in the order they were opened. */
    projects,
    current,
    addFolder,
    openFolder,
    closeFolder,
    clearFolders,
  };
}
