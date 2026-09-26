import { useEffect, useState } from "react";
import { homeDir } from "@tauri-apps/api/path";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Settings } from "lucide-react";
import { SettingsDialog } from "@/components/SettingsDialog";
import { Welcome } from "@/components/Welcome";
import { Workspace } from "@/components/Workspace";
import { Button } from "@/components/ui/button";
import { useFolderDrop } from "@/hooks/useFolderDrop";
import { useFolders } from "@/hooks/useFolders";
import { useSettings } from "@/hooks/useSettings";
import { useTabs } from "@/hooks/useTabs";
import { codeThemesFor } from "@/lib/codeThemes";
import { confirmBeforeClose, confirmQuit } from "@/lib/lifecycle";
import { setAppMenu } from "@/lib/menu";
import { tildify } from "@/lib/paths";
import { cn } from "@/lib/utils";

const win = getCurrentWindow();

export default function App() {
  const {
    loaded,
    folders,
    current,
    addFolder,
    openFolder,
    closeFolder,
    clearFolders,
  } = useFolders();
  const [settings, setSettings] = useSettings();
  const tabs = useTabs(current);
  const dragging = useFolderDrop(addFolder);
  const [home, setHome] = useState("");
  const [focused, setFocused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  // The macOS menu bar is app-wide, so the focused window owns its handlers.
  const { active, close: closeTab } = tabs;
  useEffect(() => {
    if (!loaded || !focused) return;
    setAppMenu({
      folders,
      label: (path) => tildify(path, home),
      openFolder,
      selectFolder: addFolder,
      closeFolder,
      clearFolders,
      openSettings: () => setSettingsOpen(true),
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
  ]);

  if (!loaded) return null;

  const settingsButton = (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setSettingsOpen(true)}
      aria-label="Settings"
    >
      <Settings />
    </Button>
  );

  return (
    <div
      className={cn(
        "flex h-screen",
        dragging && "ring-2 ring-foreground/20 ring-inset",
      )}
    >
      {current ? (
        <Workspace
          key={current}
          folder={current}
          tabs={tabs}
          codeThemes={codeThemesFor(settings.theme)}
          hideGitIgnored={settings.files.hide_gitignored}
          actions={settingsButton}
        />
      ) : (
        <div className="flex flex-1 flex-col">
          <div
            data-tauri-drag-region
            className="flex h-13 shrink-0 items-center justify-end px-2"
          >
            {settingsButton}
          </div>
          <Welcome
            folders={folders}
            home={home}
            onOpenFolder={openFolder}
            onSelectFolder={addFolder}
          />
        </div>
      )}
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onChange={setSettings}
      />
    </div>
  );
}
