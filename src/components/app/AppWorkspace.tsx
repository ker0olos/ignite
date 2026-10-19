import type { RemoteStatus } from "../../../shared/remote";
import { TitleButtons } from "@/components/app/TitleButtons";
import { Workspace } from "@/components/app/Workspace";
import { RemoteDevices } from "@/components/remote/RemoteDevices";
import type { Section } from "@/components/settings/sections";
import { SignInBanner } from "@/components/sidebar/SignInBanner";
import { UpdateBanner } from "@/components/sidebar/UpdateBanner";
import type { useAbout } from "@/hooks/useAbout";
import type { useAgentSession } from "@/hooks/useAgentSession";
import type { useCommandCenter } from "@/hooks/useCommandCenter";
import type { Conversations } from "@/hooks/useConversations";
import type { useMcpServers } from "@/hooks/useMcpServers";
import type { useTabs } from "@/hooks/useTabs";
import type { useTerminalTabs } from "@/hooks/useTerminalTabs";
import { childTabId } from "@/lib/childTabs";
import { codeThemesFor } from "@/lib/codeThemes";
import type { TaggedAgentStatus } from "@/lib/conversations";
import { needingSignIn } from "@/lib/mcpServers";
import { basename } from "@/lib/paths";
import type { HostClient } from "@/lib/piHost";
import { approvalSetting, modelRouterSetting } from "@/lib/composerSettings";
import type { MenuEntry } from "@/lib/inAppMenu";
import type { Settings } from "@/lib/settings";

type AppWorkspaceProps = {
  folder: string;
  tabs: ReturnType<typeof useTabs>;
  settings: Settings;
  setSettings: (settings: Settings) => Promise<void>;
  /** The in-app menu's entries; none on macOS. */
  menu: MenuEntry[];
  folders: string[];
  rows: (cwd: string) => TaggedAgentStatus[];
  tags: string[];
  tagFilter: string[];
  onToggleTagFilter: (tag: string) => void;
  onClearTagFilter: () => void;
  onSetConversationTags: (session: string, tags: string[]) => void;
  session: ReturnType<typeof useAgentSession>;
  conversations: Conversations;
  home: string;
  command: ReturnType<typeof useCommandCenter>;
  mcp: ReturnType<typeof useMcpServers>;
  remote: RemoteStatus | null;
  openFolder: () => void;
  openSettings: (section?: Section) => void;
  host: HostClient | null;
  terminals: ReturnType<typeof useTerminalTabs>;
  /** Opens a tab in any folder, selecting it first. */
  openIn: (folder: string, tab: string, session?: string) => void;
  /** Opens a terminal's tab in the conversation that has it. */
  openTerminal: (cwd: string, terminal: string) => void;
  about: ReturnType<typeof useAbout>;
};

/** The open folder's workspace, wired to the app: settings, folders, MCP sign-ins, remote devices. */
export function AppWorkspace({
  folder,
  tabs,
  settings,
  setSettings,
  menu,
  folders,
  rows,
  session,
  conversations,
  home,
  command,
  mcp,
  remote,
  openFolder,
  openSettings,
  host,
  terminals,
  openIn,
  openTerminal,
  tags,
  tagFilter,
  onToggleTagFilter,
  onClearTagFilter,
  onSetConversationTags,
  about,
}: AppWorkspaceProps) {
  return (
    <Workspace
      folder={folder}
      tabs={tabs}
      codeThemes={codeThemesFor(settings.theme)}
      editor={settings.editor}
      hideGitIgnored={settings.files.hide_gitignored}
      showFileTree={settings.files.show_tree}
      showThinking={settings.conversation.show_thinking}
      stickyUserMessages={settings.conversation.sticky_user_messages}
      gitStatus={settings.composer.git_status}
      resizableProjectSplit={settings.sidebar.resizable_split}
      approval={approvalSetting(settings, setSettings)}
      modelRouter={modelRouterSetting(settings, setSettings)}
      actions={<TitleButtons menu={menu} onSettings={() => openSettings()} />}
      projectList={{
        folders,
        rows,
        shown: session.session,
        conversations,
        conversationLimit: {
          enabled: settings.sidebar.max_conversations_enabled,
          max: settings.sidebar.max_conversations,
        },
        home,
        onDismiss: conversations.dismiss,
        onHistory: (path) => command.openWith(`@${basename(path)} @convos `),
        onOpenFolder: openFolder,
        tags,
        tagFilter,
        onToggleTagFilter,
        onClearTagFilter,
        onSetConversationTags,
        childActions: {
          shownTabs: [tabs.side.active, tabs.bottom.active].filter(
            (t) => t !== null,
          ),
          onOpenTab: (cwd, shown, tab) => {
            conversations.show(cwd, shown);
            openIn(cwd, tab, shown);
          },
          onClear: (tab) => tabs.close(tab),
          onStopBackground: (shown, pid) =>
            void host
              ?.request({ type: "background_stop", session: shown, pid })
              .catch(() => {}),
          terminals: terminals.running,
          terminalLabel: terminals.label,
          terminalOwner: (terminal) =>
            tabs.ownerOf(
              childTabId({ kind: "terminal", session: "", terminal }),
            ),
          onOpenTerminal: openTerminal,
          onStopTerminal: terminals.stop,
        },
      }}
      banner={
        <>
          <UpdateBanner
            update={about.update}
            warning={about.warning}
            onRestart={about.restart}
          />
          <SignInBanner
            names={needingSignIn(mcp.servers)}
            onSignIn={mcp.signIn}
            onOpenSettings={() => openSettings("MCP")}
          />
        </>
      }
      footer={
        <RemoteDevices
          count={remote?.devices ?? 0}
          onClick={() => openSettings("Remote")}
        />
      }
      session={session}
      host={host}
    />
  );
}
