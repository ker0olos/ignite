import type { AgentStatus } from "../../../shared/hostProtocol";
import { CommandCenter } from "@/components/command/CommandCenter";
import type { useCommandCenter } from "@/hooks/useCommandCenter";
import type { Conversations } from "@/hooks/useConversations";
import { codeThemesFor } from "@/lib/codeThemes";
import type { HostClient } from "@/lib/piHost";
import type { Settings } from "@/lib/settings";

/** ⌘K's command center, wired to the app: picking opens the conversation, file or folder. */
export function AppCommandCenter({
  command,
  host,
  folders,
  home,
  rows,
  conversations,
  settings,
  openFile,
  openFolder,
}: {
  command: ReturnType<typeof useCommandCenter>;
  host: HostClient | null;
  folders: string[];
  home: string;
  rows: (cwd: string) => AgentStatus[];
  conversations: Conversations;
  settings: Settings;
  openFile: (folder: string, path: string) => void;
  openFolder: (folder: string) => void;
}) {
  return (
    <CommandCenter
      key={command.opening}
      open={command.open}
      onOpenChange={command.setOpen}
      initialQuery={command.query}
      host={host}
      folders={folders}
      home={home}
      rows={rows}
      details={conversations.details}
      themes={codeThemesFor(settings.theme)}
      editor={settings.editor}
      preview={command.preview}
      actions={{
        onConversation: (folder, id) => conversations.show(folder, id),
        onFile: openFile,
        onFolder: openFolder,
      }}
    />
  );
}
