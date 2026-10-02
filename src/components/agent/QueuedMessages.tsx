import { ArrowUp, Pencil, X } from "lucide-react";
import type { QueuedMessage, Unqueue } from "../../../shared/queue";
import { typedSkill } from "../../../shared/skills";
import { Kbd } from "@/components/agent/Kbd";
import type { Queued } from "@/lib/queue";
import { cn } from "@/lib/utils";

const ICON =
  "flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground max-sm:size-9";

/** Messages sent mid-run that the agent hasn't read yet: edit, move up (the first: send now), remove. */
export function QueuedMessages({
  queued,
  unqueue,
  onEdit,
}: {
  queued: Queued[];
  /** Takes one back, moves it up or sends it now (see Unqueue). */
  unqueue: (
    q: Queued,
    action?: Unqueue["action"],
  ) => Promise<QueuedMessage | null>;
  /** Puts a taken-back message in the composer. */
  onEdit: (m: QueuedMessage) => void;
}) {
  if (queued.length === 0) return null;
  return (
    <ul className="flex flex-col gap-0.5 px-0.5 pt-3">
      {queued.map((q, i) => (
        <li
          key={`${q.kind}-${i}`}
          className="flex items-center gap-2 text-[13px] text-muted-foreground"
        >
          <span className="w-4 shrink-0 text-xs text-muted-foreground/70 tabular-nums">
            {i + 1}
          </span>
          {i === 0 && (
            <span className="shrink-0 text-xs text-muted-foreground/70">
              Next
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-foreground/80">
            {typedSkill(q.text) || "Image"}
          </span>
          <button
            type="button"
            aria-label="Edit"
            title="Edit"
            className={ICON}
            onClick={() => void unqueue(q).then((m) => m && onEdit(m))}
          >
            <Pencil className="size-3.5" />
          </button>
          {i === 0 ? (
            <button
              type="button"
              aria-label="Steer"
              title="Steer: stop the agent and send this now"
              className={cn(ICON, "w-auto gap-1.5 px-1")}
              onClick={() => void unqueue(q, "now")}
            >
              <ArrowUp className="size-3.5" />
              <Kbd>⇧⌘↵</Kbd>
            </button>
          ) : (
            <button
              type="button"
              aria-label="Move up"
              title="Move up"
              className={ICON}
              onClick={() => void unqueue(q, "up")}
            >
              <ArrowUp className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            aria-label="Remove"
            title="Remove"
            className={ICON}
            onClick={() => void unqueue(q)}
          >
            <X className="size-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}
