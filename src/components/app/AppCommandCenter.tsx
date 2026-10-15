import type { AgentStatus } from "../../../shared/hostProtocol";
import { lazy, Suspense, useEffect } from "react";
import type { useCommandCenter } from "@/hooks/useCommandCenter";
import type { Conversations } from "@/hooks/useConversations";
import { codeThemesFor } from "@/lib/codeThemes";
import type { HostClient } from "@/lib/piHost";
import type { Settings } from "@/lib/settings";
import { prefetchCommandSearch } from "@/hooks/useCommandSearch";
import { prefetchDetails } from "@/hooks/useDetailsCache";
import { useOpenedOnce } from "@/hooks/useOpenedOnce";

const load = () => import("@/components/command/CommandCenter");
const CommandCenter = lazy(() =>
  load().then((m) => ({ default: m.CommandCenter })),
);

const PREFETCH_MS = 2000;

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
  const { details } = conversations;
  useEffect(() => {
    if (!host) return;
    const id = setTimeout(async () => {
      const first = (await prefetchCommandSearch(host, folders))
        .conversations[0];
      if (first) prefetchDetails(details, first.folder, first.id);
    }, PREFETCH_MS);
    return () => clearTimeout(id);
  }, [host, folders, details]);

  if (!useOpenedOnce(command.open, load)) return null;
  return (
    <Suspense>
      <CommandCenter
        key={command.opening}
        open={command.open}
        onOpenChange={command.setOpen}
        initialQuery={command.query}
        host={host}
        folders={folders}
        home={home}
        rows={rows}
        details={details}
        themes={codeThemesFor(settings.theme)}
        editor={settings.editor}
        preview={command.preview}
        actions={{
          onConversation: (folder, id) => conversations.show(folder, id),
          onFile: openFile,
          onFolder: openFolder,
        }}
      />
    </Suspense>
  );
}
