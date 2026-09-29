import { X } from "lucide-react";
import type {
  SavedSession,
  SessionDetails,
} from "../../../shared/conversations";
import { ConversationHistory } from "@/components/sidebar/ConversationHistory";
import { basename } from "@/lib/paths";

/** History and dismiss buttons for a folder row, shown on hover. */
export function ProjectRowActions({
  path,
  history,
  details,
  onShowSession,
  onDismiss,
}: {
  path: string;
  history: () => Promise<SavedSession[]>;
  details: (session: string) => Promise<SessionDetails | null>;
  onShowSession: (session: string) => void;
  onDismiss: () => void;
}) {
  const name = basename(path);

  return (
    <div className="mr-1 flex shrink-0 items-center gap-0.5">
      <ConversationHistory
        folderName={name}
        history={history}
        details={details}
        onShow={onShowSession}
      />
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        aria-label={`Remove ${name} from the sidebar`}
        title="Remove from the sidebar (stays in Open Recent)"
        className="shrink-0 rounded-md p-1 opacity-0 hover:bg-foreground/10 focus-visible:opacity-100 group-hover:opacity-100"
      >
        <X className="size-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}
