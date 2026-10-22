import type { Reflection } from "../../../shared/reflector";
import { reflectionOrigin } from "@/lib/reflector";

/** Where a point came from, beside it: the conversation (opens it), then what taught it and when. */
export function ReflectionSource({
  reflection,
  onOpenConversation,
}: {
  reflection: Reflection;
  onOpenConversation: (folder: string, conversation: string) => void;
}) {
  const { taught, conversation, when, date } = reflectionOrigin(reflection);
  const { from } = reflection;
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
        {taught} · <span title={date}>{when}</span>
      </span>
    </span>
  );
}
