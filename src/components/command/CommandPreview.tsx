import type {
  ConversationHit,
  SessionDetails,
} from "../../../shared/conversations";
import type { AgentStatus } from "../../../shared/hostProtocol";
import { ConversationDetails } from "@/components/command/ConversationDetails";
import { FolderPreview } from "@/components/command/FolderPreview";
import { FileView } from "@/components/files/FileView";
import type { CodeThemes } from "@/lib/codeThemes";
import type { CommandPick } from "@/lib/commandQuery";
import type { Settings } from "@/lib/settings";

// Highlighting a whole file per highlighted result stalls typing.
const PREVIEW_LINES = 150;

/** The command center's right pane: what the highlighted result is, or how to search. */
export function CommandPreview({
  pick,
  conversations,
  details,
  rows,
  home,
  themes,
  editor,
  query,
}: {
  pick: CommandPick | null;
  conversations: ConversationHit[];
  details: Record<string, SessionDetails | null>;
  rows: (cwd: string) => AgentStatus[];
  home: string;
  themes: CodeThemes;
  editor: Settings["editor"];
  query: string;
}) {
  if (pick?.kind === "conversation") {
    const hit = conversations.find(
      (c) => c.folder === pick.folder && c.id === pick.id,
    );
    return hit ? (
      <ConversationDetails
        saved={hit}
        details={details[hit.id]}
        query={query}
      />
    ) : null;
  }
  if (pick?.kind === "file") {
    const path = `${pick.folder}/${pick.path}`;
    return (
      <FileView
        key={path}
        path={path}
        root={pick.folder}
        themes={themes}
        editor={editor}
        lines={PREVIEW_LINES}
      />
    );
  }
  if (pick?.kind === "folder") {
    return (
      <FolderPreview
        folder={pick.folder}
        home={home}
        conversations={rows(pick.folder)}
      />
    );
  }
  return (
    <p className="text-[13px] text-muted-foreground">
      Search conversations, files and folders. Start with @name to look in one
      folder, or @conversations, @files or @folders for one kind.
    </p>
  );
}
