import { useEffect, useState } from "react";
import { homeDir } from "@tauri-apps/api/path";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Settings } from "lucide-react";
import { SettingsDialog } from "@/components/SettingsDialog";
import { Sidebar } from "@/components/Sidebar";
import { Welcome } from "@/components/Welcome";
import { Workspace } from "@/components/Workspace";
import { Button } from "@/components/ui/button";
import { useFolderDrop } from "@/hooks/useFolderDrop";
import { useFolders } from "@/hooks/useFolders";
import { useTheme } from "@/hooks/useTheme";
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
  const [theme, setTheme] = useTheme();
  const dragging = useFolderDrop(addFolder);
  const [home, setHome] = useState("");
  const [focused, setFocused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    homeDir().then(setHome);
    win.isFocused().then(setFocused);
    const unlisten = win.onFocusChanged(({ payload }) => setFocused(payload));
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  // The macOS menu bar is app-wide, so the focused window owns its handlers.
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
        <>
          <Sidebar folder={current} actions={settingsButton} />
          <Workspace folder={current} home={home} />
        </>
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
        theme={theme}
        onThemeChange={setTheme}
      />
    </div>
  );
}
