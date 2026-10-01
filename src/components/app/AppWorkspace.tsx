import type { ReactNode } from "react";
import type { AgentStatus } from "../../../shared/hostProtocol";
import type { RemoteStatus } from "../../../shared/remote";
import { Workspace } from "@/components/app/Workspace";
import { RemoteDevices } from "@/components/remote/RemoteDevices";
import type { Section } from "@/components/settings/sections";
import { SignInBanner } from "@/components/sidebar/SignInBanner";
import type { useAgentSession } from "@/hooks/useAgentSession";
import { useClearedChildren } from "@/hooks/useClearedChildren";
import type { useCommandCenter } from "@/hooks/useCommandCenter";
import type { Conversations } from "@/hooks/useConversations";
import type { useMcpServers } from "@/hooks/useMcpServers";
import type { useTabs } from "@/hooks/useTabs";
import { codeThemesFor } from "@/lib/codeThemes";
import { needingSignIn } from "@/lib/mcpServers";
import { basename } from "@/lib/paths";
import type { HostClient } from "@/lib/piHost";
import { approvalSetting, type Settings } from "@/lib/settings";

/** The open folder's workspace, wired to the app: settings, folders, MCP sign-ins, remote devices. */
export function AppWorkspace({
  folder,
  tabs,
  settings,
  setSettings,
  settingsButton,
  folders,
  rows,
  session,
  chats,
  home,
  command,
  mcp,
  remote,
  openFolder,
  openSettings,
  host,
  openIn,
}: {
  folder: string;
  tabs: ReturnType<typeof useTabs>;
  settings: Settings;
  setSettings: (settings: Settings) => Promise<void>;
  settingsButton: ReactNode;
  folders: string[];
  rows: (cwd: string) => AgentStatus[];
  session: ReturnType<typeof useAgentSession>;
  chats: Conversations;
  home: string;
  command: ReturnType<typeof useCommandCenter>;
  mcp: ReturnType<typeof useMcpServers>;
  remote: RemoteStatus | null;
  openFolder: () => void;
  openSettings: (section?: Section) => void;
  host: HostClient | null;
  /** Opens a tab in any folder, selecting it first. */
  openIn: (folder: string, tab: string) => void;
}) {
  const cleared = useClearedChildren();
  return (
    <Workspace
      folder={folder}
      tabs={tabs}
      codeThemes={codeThemesFor(settings.theme)}
      editor={settings.editor}
      hideGitIgnored={settings.files.hide_gitignored}
      showThinking={settings.conversation.show_thinking}
      resizableProjectSplit={settings.conversation.resizable_sidebar_split}
      approval={approvalSetting(settings, setSettings)}
      actions={settingsButton}
      projectList={{
        folders,
        rows,
        shown: session.session,
        conversations: chats,
        home,
        onDismiss: chats.dismiss,
        onHistory: (path) => command.openWith(`@${basename(path)} #convos `),
        onOpenFolder: openFolder,
        childActions: {
          activeTab: tabs.active,
          onOpenTab: (cwd, shown, tab) => {
            chats.show(cwd, shown);
            openIn(cwd, tab);
          },
          cleared: cleared.cleared,
          onClear: (tab) => {
            cleared.clear(tab);
            tabs.close(tab);
          },
          onStopBackground: (shown, pid) =>
            void host
              ?.request({ type: "background_stop", session: shown, pid })
              .catch(() => {}),
        },
      }}
      banner={
        <SignInBanner
          names={needingSignIn(mcp.servers)}
          onSignIn={mcp.signIn}
          onOpenSettings={() => openSettings("MCP")}
        />
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
