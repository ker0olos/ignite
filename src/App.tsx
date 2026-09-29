import { SettingsButton } from "@/components/app/SettingsButton";
import { Welcome } from "@/components/app/Welcome";
import { Workspace } from "@/components/app/Workspace";
import { ConnectProviders } from "@/components/providers/ConnectProviders";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { SignInBanner } from "@/components/sidebar/SignInBanner";
import { useFolderDrop } from "@/hooks/useFolderDrop";
import { useAgentSession } from "@/hooks/useAgentSession";
import { useAppMenu } from "@/hooks/useAppMenu";
import { useConnectScreen } from "@/hooks/useConnectScreen";
import { useFolders } from "@/hooks/useFolders";
import { useMcpServers } from "@/hooks/useMcpServers";
import { useProjects } from "@/hooks/useProjects";
import { useProviders } from "@/hooks/useProviders";
import { useSettings } from "@/hooks/useSettings";
import { useSettingsDialog } from "@/hooks/useSettingsDialog";
import { useTabs } from "@/hooks/useTabs";
import { useTextSize } from "@/hooks/useTextSize";
import { codeThemesFor } from "@/lib/codeThemes";
import { needingSignIn } from "@/lib/mcpServers";
import { approvalSetting } from "@/lib/settings";
import { DEMO_FOLDER, shownSession, shownStatuses } from "@/lib/demo";
import { cn } from "@/lib/utils";

export default function App() {
  const {
    loaded,
    folders,
    projects,
    current,
    addFolder,
    openFolder,
    closeFolder,
    clearFolders,
  } = useFolders();
  const [settings, setSettings] = useSettings();
  useTextSize(settings, setSettings);
  const providers = useProviders();
  const connectScreen = useConnectScreen(providers.statuses);
  // The demo folder shows a fixed conversation; pi never runs in it.
  const live = DEMO_FOLDER ? null : current;
  const agent = useAgentSession(providers.host, live, providers.statuses);
  const session = shownSession(agent, providers.hostError, current);
  const mcp = useMcpServers(providers.host, live);
  const statuses = shownStatuses(useProjects(providers.host, projects));
  const tabs = useTabs(current);
  const dragging = useFolderDrop(addFolder);
  const dialog = useSettingsDialog(providers.host, current);
  const openSettings = dialog.show;

  const { home } = useAppMenu({
    loaded,
    folders,
    openFolder,
    addFolder,
    closeFolder,
    clearFolders,
    openSettings: () => openSettings(),
    version: dialog.about.version,
    checkForUpdates: dialog.checkForUpdates,
    active: tabs.active,
    closeTab: tabs.close,
  });

  if (!loaded) return null;

  const settingsButton = <SettingsButton onClick={() => openSettings()} />;

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
          approval={approvalSetting(settings, setSettings)}
          actions={settingsButton}
          projectList={{
            folders,
            projects,
            statuses,
            home,
            onSelect: addFolder,
            onClose: closeFolder,
            onOpenFolder: openFolder,
          }}
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
        key={dialog.section}
        initialSection={dialog.section}
        open={dialog.open}
        onOpenChange={dialog.setOpen}
        settings={settings}
        onChange={setSettings}
        providers={providers.statuses}
        providersError={providers.hostError}
        mcp={mcp}
        memory={dialog.memory}
        about={dialog.about}
        folder={current}
        onManageProviders={() => {
          dialog.setOpen(false);
          connectScreen.show();
        }}
      />
    </div>
  );
}
