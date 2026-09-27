import { useEffect, useState } from "react";
import { homeDir } from "@tauri-apps/api/path";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { useFolders } from "@/hooks/useFolders";
import { confirmBeforeClose, confirmQuit } from "@/lib/lifecycle";
import { setAppMenu } from "@/lib/menu";
import { tildify } from "@/lib/paths";

const win = getCurrentWindow();

type Folders = Pick<
  ReturnType<typeof useFolders>,
  "folders" | "openFolder" | "addFolder" | "closeFolder" | "clearFolders"
>;

/**
 * Tracks this window's home directory and focus, and rewires the macOS app
 * menu (app-wide) to this window's handlers whenever it gains focus.
 */
export function useAppMenu({
  loaded,
  folders,
  openFolder,
  addFolder,
  closeFolder,
  clearFolders,
  openSettings,
  active,
  closeTab,
}: Folders & {
  loaded: boolean;
  openSettings: () => void;
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

  useEffect(() => {
    if (!loaded || !focused) return;
    setAppMenu({
      folders,
      label: (path) => tildify(path, home),
      openFolder,
      selectFolder: addFolder,
      closeFolder,
      clearFolders,
      openSettings,
      // ⌘W closes the file tab; with none open it falls through to the window.
      closeTab: () => (active ? closeTab(active) : win.close()),
      closeWindow: () => win.close(),
      quit: confirmQuit,
    });
  }, [
    loaded,
    focused,
    folders,
    home,
    openFolder,
    addFolder,
    closeFolder,
    clearFolders,
    active,
    closeTab,
    openSettings,
  ]);

  return { home };
}
