import type { LearnedIn } from "../../../shared/reflector";

/** Where something the agent learned came from, beside its row: the conversation (opens it), then how and when. */
export function LearnedSource({
  from,
  conversation,
  how,
  when,
  date,
  onOpenConversation,
}: {
  from?: LearnedIn;
  /** The conversation's name as the link shows it. */
  conversation: string | null;
  how: string;
  when: string;
  /** The full date, on hover. */
  date: string;
  onOpenConversation: (folder: string, conversation: string) => void;
}) {
  return (
    <span className="flex w-44 flex-col items-end gap-0.5 text-right">
      {from && (
        <button
          type="button"
          className="max-w-full truncate text-xs underline decoration-muted-foreground/50 underline-offset-3 hover:decoration-foreground"
          onClick={() => onOpenConversation(from.folder, from.conversation)}
        >
          {conversation}
        </button>
      )}
      <span className="text-[11px] text-muted-foreground">
        {how} · <span title={date}>{when}</span>
      </span>
    </span>
  );
}
