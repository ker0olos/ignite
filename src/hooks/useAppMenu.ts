import { useEffect, useRef, useState } from "react";
import { homeDir } from "@tauri-apps/api/path";
import type { AppVersion } from "../../shared/hostProtocol";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { closeFrontTab } from "@/hooks/useFrontTabClose";
import type { useFolders } from "@/hooks/useFolders";
import { confirmBeforeClose, confirmQuit } from "@/lib/lifecycle";
import { menuItems, setAppMenu, type MenuHandlers } from "@/lib/menu";
import { tildify } from "@/lib/paths";
import { isMac } from "@/lib/window";
import { entryForKey, inAppMenuEntries, type MenuEntry } from "@/lib/inAppMenu";

const win = getCurrentWindow();

type Folders = Pick<
  ReturnType<typeof useFolders>,
  "folders" | "openFolder" | "addFolder" | "closeFolder" | "clearFolders"
>;

/**
 * Tracks this window's home directory and focus, and rewires the macOS app
 * menu (app-wide) to this window's handlers whenever it gains focus. On
 * Windows and Linux there is no menu bar: it returns the same items as
 * `menu`, and their shortcuts are handled here.
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

  // Actions read the latest handlers here, so the menu is rebuilt only when what it shows changes.
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

  const inApp = !isMac();
  const handlers = (): MenuHandlers => {
    const h = () => latest.current;
    return {
      version,
      checkForUpdates: () => h().checkForUpdates(),
      folders,
      label: (path) => tildify(path, home),
      openFolder: () => h().openFolder(),
      selectFolder: (path) => h().addFolder(path),
      closeFolder: () => h().closeFolder(),
      clearFolders: () => h().clearFolders(),
      openSettings: () => h().openSettings(),
      // ⌘W closes the IDE layouts' front tab, else the file tab; with none open, the window.
      closeTab: () => {
        if (!closeFrontTab()) return;
        const { active, closeTab } = h();
        return active ? closeTab(active) : win.close();
      },
      closeWindow: () => win.close(),
      quit: confirmQuit,
    };
  };

  const [menu, setMenu] = useState<MenuEntry[]>([]);
  useEffect(() => {
    if (!loaded) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (inApp) setMenu(inAppMenuEntries(menuItems(handlers())));
    else if (focused) setAppMenu(handlers());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, inApp, focused, folders, home, version]);

  useEffect(() => {
    if (!menu.length) return;
    const onKey = (e: KeyboardEvent) => {
      const action = entryForKey(menu, e);
      if (!action) return;
      e.preventDefault();
      action();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  return { home, menu };
}
