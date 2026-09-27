import { useEffect, useState } from "react";
import { homeDir } from "@tauri-apps/api/path";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Settings } from "lucide-react";
import { ConnectProviders } from "@/components/ConnectProviders";
import { SettingsDialog, type Section } from "@/components/SettingsDialog";
import { SignInBanner } from "@/components/SignInBanner";
import { Welcome } from "@/components/Welcome";
import { Workspace } from "@/components/Workspace";
import { Button } from "@/components/ui/button";
import { useFolderDrop } from "@/hooks/useFolderDrop";
import { useAgentSession } from "@/hooks/useAgentSession";
import { useConnectScreen } from "@/hooks/useConnectScreen";
import { useFolders } from "@/hooks/useFolders";
import { useMcpServers } from "@/hooks/useMcpServers";
import { useProviders } from "@/hooks/useProviders";
import { useSettings } from "@/hooks/useSettings";
import { useTabs } from "@/hooks/useTabs";
import { codeThemesFor } from "@/lib/codeThemes";
import { needingSignIn } from "@/lib/mcpServers";
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
  const providers = useProviders();
  const connectScreen = useConnectScreen(providers.statuses);
  const agent = useAgentSession(providers.host, current, providers.statuses);
  // Without a host the session never opens; show why instead of loading.
  const session = { ...agent, error: agent.error ?? providers.hostError };
  const mcp = useMcpServers(providers.host, current);
  const tabs = useTabs(current);
  const dragging = useFolderDrop(addFolder);
  const [home, setHome] = useState("");
  const [focused, setFocused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<Section>("Providers");
  const openSettings = (section: Section = "Providers") => {
    setSettingsSection(section);
    setSettingsOpen(true);
  };

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
      openSettings: () => openSettings(),
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
      onClick={() => openSettings()}
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
      {connectScreen.open ? (
        <div className="flex-1">
          <ConnectProviders
            providers={providers}
            onDone={connectScreen.dismiss}
          />
        </div>
      ) : current ? (
        <Workspace
          key={current}
          folder={current}
          tabs={tabs}
          codeThemes={codeThemesFor(settings.theme)}
          editor={settings.editor}
          hideGitIgnored={settings.files.hide_gitignored}
          showThinking={settings.conversation.show_thinking}
          actions={settingsButton}
          banner={
            <SignInBanner
              names={needingSignIn(mcp.servers)}
              onSignIn={mcp.signIn}
              onOpenSettings={() => openSettings("MCP")}
            />
          }
          session={session}
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
        key={settingsSection}
        initialSection={settingsSection}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onChange={setSettings}
        providers={providers.statuses}
        providersError={providers.hostError}
        mcp={mcp}
        onManageProviders={() => {
          setSettingsOpen(false);
          connectScreen.show();
        }}
      />
    </div>
  );
}
