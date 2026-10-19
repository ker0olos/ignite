import { DropOverlay } from "@/components/app/DropOverlay";
import { AppCommandCenter } from "@/components/app/AppCommandCenter";
import { AppSettingsDialog } from "@/components/app/AppSettingsDialog";
import { AppWorkspace } from "@/components/app/AppWorkspace";
import { TitleButtons } from "@/components/app/TitleButtons";
import { WelcomeScreen } from "@/components/app/WelcomeScreen";
import { ConnectProviders } from "@/components/providers/ConnectProviders";
import { useDrop } from "@/hooks/useDrop";
import { useAgentSession } from "@/hooks/useAgentSession";
import { useAppMenu } from "@/hooks/useAppMenu";
import { useCommandCenter } from "@/hooks/useCommandCenter";
import { useConnectScreen } from "@/hooks/useConnectScreen";
import { useFolders } from "@/hooks/useFolders";
import { useMcpServers } from "@/hooks/useMcpServers";
import { useConversationList } from "@/hooks/useConversationList";
import { useConversations } from "@/hooks/useConversations";
import { useConversationTabs } from "@/hooks/useConversationTabs";
import { useProviders } from "@/hooks/useProviders";
import { useRemoteAccess } from "@/hooks/useRemoteAccess";
import { useNotifications } from "@/hooks/useNotifications";
import { useSettings } from "@/hooks/useSettings";
import { useSettingsDialog } from "@/hooks/useSettingsDialog";
import { useTextSize } from "@/hooks/useTextSize";
import { WindowControls } from "@/components/app/WindowControls";
import { isRemote } from "@/lib/remote";
import { isWindows } from "@/lib/window";
import { OPEN_HOST, shownRows, shownSession } from "@/lib/demo";
import { orderedRows } from "@/lib/conversations";

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
  useNotifications(host, settings.notifications);
  const agent = useAgentSession(host, current, providers.statuses);
  const session = shownSession(agent, providers.hostError);
  const mcp = useMcpServers(host, current);
  const list = useConversationList(host);
  const shownConversations = useConversations(host, current, agent, {
    select: addFolder,
    dismiss: dismissFolder,
    forget: list.forget,
  });
  const conversationTabs = useConversationTabs(
    host,
    current,
    shownFolders,
    agent,
    shownConversations,
    addFolder,
    shownRows(list.allRows),
  );
  const command = useCommandCenter();
  const rows = (cwd: string) =>
    orderedRows(shownRows(list.rows)(cwd), settings.sidebar.conversation_order);
  const dropping = useDrop(addFolder);
  const dialog = useSettingsDialog(providers.host, current);
  const openSettings = dialog.show;

  const { home, menu } = useAppMenu({
    loaded,
    folders,
    openFolder,
    addFolder,
    closeFolder,
    clearFolders,
    openSettings: () => openSettings(),
    version: dialog.about.version,
    checkForUpdates: dialog.checkForUpdates,
    active: conversationTabs.tabs.active,
    closeTab: conversationTabs.tabs.close,
  });

  if (!loaded) return null;

  const settingsButton = (
    <TitleButtons menu={menu} onSettings={() => openSettings()} />
  );

  return (
    <div className="flex h-dvh">
      {dropping && <DropOverlay preview={dropping} />}
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
          {...{ settings, setSettings, menu, rows, session }}
          tags={list.tags}
          tagFilter={list.tagFilter}
          onToggleTagFilter={list.toggleTagFilter}
          onClearTagFilter={list.clearTagFilter}
          onSetConversationTags={list.setConversationTags}
          {...{
            home,
            command,
            mcp,
            remote,
            openFolder,
            openSettings,
          }}
          {...conversationTabs}
          host={host}
          about={dialog.about}
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
      {isWindows() && !isRemote() && <WindowControls />}
      <AppCommandCenter
        {...{ command, home, rows, settings }}
        openFile={conversationTabs.openFile}
        host={host}
        folders={folders}
        conversations={conversationTabs.conversations}
        openFolder={addFolder}
      />
    </div>
  );
}
