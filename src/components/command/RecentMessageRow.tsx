import type { RecentMessage } from "../../../shared/conversations";
import { Highlight } from "@/components/command/Highlight";
import { replyNote } from "@/lib/conversations";

/** One of a conversation's latest messages: the user's as a bubble, a reply as text under what it did. */
export function RecentMessageRow({
  message,
  query,
}: {
  message: RecentMessage;
  query: string;
}) {
  if (message.role === "user") {
    return (
      <p className="line-clamp-4 max-w-[85%] self-end rounded-2xl rounded-br-sm bg-muted px-3 py-2 whitespace-pre-line">
        <Highlight text={message.text} query={query} />
      </p>
    );
  }
  const note = replyNote(message);
  return (
    <div className="flex flex-col items-start gap-1.5">
      {note && (
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {note}
        </span>
      )}
      {message.text && (
        <p className="line-clamp-5 whitespace-pre-line">
          <Highlight text={message.text} query={query} />
        </p>
      )}
    </div>
  );
}
