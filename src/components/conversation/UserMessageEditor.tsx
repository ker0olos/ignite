import type { KeyboardEvent } from "react";
import type { ImageContent } from "../../../shared/agentTypes";
import { ZoomableImage } from "@/components/app/ZoomableImage";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** A user message being edited in place, in its bubble's look, its images kept. */
export function UserMessageEditor({
  text,
  images,
  sending,
  canSend,
  onChange,
  onKeyDown,
  onCancel,
  onSend,
}: {
  text: string;
  images: ImageContent[];
  sending: boolean;
  /** Off while it's sent, or while the conversation isn't idle. */
  canSend: boolean;
  onChange: (text: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onCancel: () => void;
  onSend: () => void;
}) {
  return (
    <div className="flex flex-col items-end gap-2">
      {images.length > 0 && (
        <div className="flex max-w-[85%] flex-wrap justify-end gap-2">
          {images.map((image, i) => (
            <ZoomableImage
              key={i}
              image={image}
              className="max-h-40 max-w-60 rounded-lg border object-contain"
            />
          ))}
        </div>
      )}
      <Textarea
        autoFocus
        aria-label="Edit message"
        value={text}
        disabled={sending}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={(e) =>
          e.currentTarget.setSelectionRange(text.length, text.length)
        }
        rows={1}
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className="max-h-[50vh] min-h-0 w-[85%] resize-none overflow-y-auto rounded-2xl border-0 bg-muted px-3 py-2 text-[length:var(--message-text,14px)] focus-visible:ring-2 md:text-[length:var(--message-text,14px)] dark:bg-muted"
      />
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <span>↵ to send, Esc to cancel</span>
        <Button type="button" variant="ghost" size="xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          size="xs"
          disabled={!canSend || (!text.trim() && !images.length)}
          onClick={onSend}
        >
          Send
        </Button>
      </div>
    </div>
  );
}
