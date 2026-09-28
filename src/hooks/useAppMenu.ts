import { useEffect, useRef, useState } from "react";
import { homeDir } from "@tauri-apps/api/path";
import type { AppVersion } from "../../shared/hostProtocol";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { useFolders } from "@/hooks/useFolders";
import { confirmBeforeClose, confirmQuit } from "@/lib/lifecycle";
import { setAppMenu } from "@/lib/menu";
import { tildify } from "@/lib/paths";
import { isWindows } from "@/lib/window";

const win = getCurrentWindow();

type Folders = Pick<
  ReturnType<typeof useFolders>,
  "folders" | "openFolder" | "addFolder" | "closeFolder" | "clearFolders"
>;

/**
 * Tracks this window's home directory and focus, and rewires the macOS app
 * menu (app-wide) to this window's handlers whenever it gains focus. On
 * Windows each window has its own menu bar, set once.
 */
export function useAppMenu({
  loaded,
  folders,
  openFolder,
  addFolder,
  closeFolder,
  clearFolders,
  openSettings,
  version,
  checkForUpdates,
  active,
  closeTab,
}: Folders & {
  loaded: boolean;
  openSettings: () => void;
  version: AppVersion | null;
  checkForUpdates: () => void;
  active: string | null;
  closeTab: (path: string) => void;
}) {
  const [home, setHome] = useState("");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    homeDir().then(setHome);
    win.isFocused().then(setFocused);
    const unlistenFocus = win.onFocusChanged(({ payload }) =>
      setFocused(payload),
    );
    const unlistenClose = confirmBeforeClose();
    return () => {
      unlistenFocus.then((f) => f());
      unlistenClose.then((f) => f());
    };
  }, []);

  // Rebuilding the menu redraws the Windows menu bar, so actions read the
  // latest handlers here and the menu is rebuilt only when what it shows changes.
  const latest = useRef({
    openFolder,
    addFolder,
    closeFolder,
    clearFolders,
    openSettings,
    checkForUpdates,
    active,
    closeTab,
  });
  useEffect(() => {
    latest.current = {
      openFolder,
      addFolder,
      closeFolder,
      clearFolders,
      openSettings,
      checkForUpdates,
      active,
      closeTab,
    };
  });

  const ownsMenu = focused || isWindows();
  useEffect(() => {
    if (!loaded || !ownsMenu) return;
    const h = () => latest.current;
    setAppMenu({
      version,
      checkForUpdates: () => h().checkForUpdates(),
      folders,
      label: (path) => tildify(path, home),
      openFolder: () => h().openFolder(),
      selectFolder: (path) => h().addFolder(path),
      closeFolder: () => h().closeFolder(),
      clearFolders: () => h().clearFolders(),
      openSettings: () => h().openSettings(),
      // ⌘W closes the file tab; with none open it falls through to the window.
      closeTab: () => {
        const { active, closeTab } = h();
        return active ? closeTab(active) : win.close();
      },
      closeWindow: () => win.close(),
      quit: confirmQuit,
    });
  }, [loaded, ownsMenu, folders, home, version]);

  return { home };
}
