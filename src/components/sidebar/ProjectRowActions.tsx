import { History, X } from "lucide-react";
import { basename } from "@/lib/paths";

const BUTTON =
  "shrink-0 rounded-md p-1 opacity-0 hover:bg-foreground/10 focus-visible:opacity-100 group-hover:opacity-100";

/** History and dismiss buttons for a folder row, shown on hover. */
export function ProjectRowActions({
  path,
  onHistory,
  onDismiss,
}: {
  path: string;
  onHistory: () => void;
  onDismiss: () => void;
}) {
  const name = basename(path);
  const act = (e: React.MouseEvent, then: () => void) => {
    e.stopPropagation();
    then();
  };

  return (
    <div className="mr-1 flex shrink-0 items-center gap-0.5">
      <button
        onClick={(e) => act(e, onHistory)}
        aria-label={`Previous conversations in ${name}`}
        className={BUTTON}
      >
        <History className="size-3.5 text-muted-foreground" />
      </button>
      <button
        onClick={(e) => act(e, onDismiss)}
        aria-label={`Remove ${name} from the sidebar`}
        title="Remove from the sidebar (stays in Open Recent)"
        className={BUTTON}
      >
        <X className="size-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}
