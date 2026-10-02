import { AppCommandCenter } from "@/components/app/AppCommandCenter";
import { AppSettingsDialog } from "@/components/app/AppSettingsDialog";
import { AppWorkspace } from "@/components/app/AppWorkspace";
import { SettingsButton } from "@/components/app/SettingsButton";
import { WelcomeScreen } from "@/components/app/WelcomeScreen";
import { ConnectProviders } from "@/components/providers/ConnectProviders";
import { useFolderDrop } from "@/hooks/useFolderDrop";
import { useAgentSession } from "@/hooks/useAgentSession";
import { useAppMenu } from "@/hooks/useAppMenu";
import { useCommandCenter } from "@/hooks/useCommandCenter";
import { useOpenFile } from "@/hooks/useOpenFile";
import { useConnectScreen } from "@/hooks/useConnectScreen";
import { useFolders } from "@/hooks/useFolders";
import { useMcpServers } from "@/hooks/useMcpServers";
import { useConversationList } from "@/hooks/useConversationList";
import { useConversations } from "@/hooks/useConversations";
import { useProviders } from "@/hooks/useProviders";
import { useRemoteAccess } from "@/hooks/useRemoteAccess";
import { useSettings } from "@/hooks/useSettings";
import { useSettingsDialog } from "@/hooks/useSettingsDialog";
import { useTabs } from "@/hooks/useTabs";
import { useTextSize } from "@/hooks/useTextSize";
import { OPEN_HOST, shownRows, shownSession } from "@/lib/demo";
import { orderedRows } from "@/lib/conversations";
import { cn } from "@/lib/utils";

export default function App() {
  const {
    loaded,
    folders,
    shownFolders,
    current,
    addFolder,
    dismissFolder,
    openFolder,
    closeFolder,
    clearFolders,
  } = useFolders();
  const [settings, setSettings] = useSettings();
  useTextSize(settings, setSettings);
  // In demo mode a scripted host stands in for the sidecar.
  const providers = useProviders(OPEN_HOST);
  const { host } = providers;
  const connectScreen = useConnectScreen(providers.statuses);
  const remote = useRemoteAccess(host, settings.remote);
  const agent = useAgentSession(host, current, providers.statuses);
  const session = shownSession(agent, providers.hostError);
  const mcp = useMcpServers(host, current);
  const list = useConversationList(host);
  const conversations = useConversations(host, current, agent, {
    select: addFolder,
    dismiss: dismissFolder,
    forget: list.forget,
  });
  const tabs = useTabs(current);
  const openIn = useOpenFile(current, tabs.open, addFolder);
  const openFile = (folder: string, path: string) =>
    openIn(folder, `${folder}/${path}`);
  const command = useCommandCenter();
  const rows = (cwd: string) =>
    orderedRows(
      shownRows(list.rows)(cwd),
      settings.conversation.conversation_order,
    );
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
        "flex h-dvh",
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
        <AppWorkspace
          key={current}
          folder={current}
          folders={shownFolders}
          {...{ tabs, settings, setSettings, settingsButton, rows, session }}
          tags={list.tags}
          tagFilter={list.tagFilter}
          onToggleTagFilter={list.toggleTagFilter}
          onClearTagFilter={list.clearTagFilter}
          onSetConversationTags={list.setConversationTags}
          {...{
            conversations,
            home,
            command,
            mcp,
            remote,
            openFolder,
            openSettings,
          }}
          host={host}
          openIn={openIn}
        />
      ) : (
        <WelcomeScreen
          settingsButton={settingsButton}
          folders={folders}
          home={home}
          onOpenFolder={openFolder}
          onSelectFolder={addFolder}
        />
      )}
      <AppSettingsDialog
        {...{ dialog, settings, providers, mcp, connectScreen }}
        onChange={setSettings}
        folder={current}
        remote={remote}
      />
      <AppCommandCenter
        {...{ command, home, rows, settings, openFile }}
        host={host}
        folders={folders}
        conversations={conversations}
        openFolder={addFolder}
      />
    </div>
  );
}
