import type { KeyboardEvent, Ref } from "react";
import type { ImageContent } from "../../../shared/agentTypes";
import { Textarea } from "@/components/ui/textarea";
import { typedText } from "@/lib/demo";
import { pastedImages } from "@/lib/images";
import { cn } from "@/lib/utils";

/** The composer's text: tells where the caret is, and attaches pasted images with the selection they replace. */
export function ComposerInput({
  ref,
  value,
  onChange,
  onCaret,
  onImages,
  onKeyDown,
  placeholder = "Describe a task",
  tight = false,
}: {
  ref: Ref<HTMLTextAreaElement>;
  placeholder?: string;
  /** Less room above, under a question's note label. */
  tight?: boolean;
  value: string;
  onChange: (text: string) => void;
  onCaret: (caret: number) => void;
  onImages: (images: ImageContent[], start: number, end: number) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <Textarea
      ref={ref}
      value={value}
      onChange={(e) => {
        onChange(typedText(e.target.value));
        onCaret(e.target.selectionStart);
      }}
      onSelect={(e) => onCaret(e.currentTarget.selectionStart)}
      onPaste={(e) => {
        const { clipboardData, currentTarget } = e;
        if (clipboardData.files.length === 0) return;
        e.preventDefault();
        const { selectionStart, selectionEnd } = currentTarget;
        void pastedImages(clipboardData).then((images) =>
          onImages(images, selectionStart, selectionEnd),
        );
      }}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      autoCorrect="off"
      autoCapitalize="off"
      autoComplete="off"
      spellCheck={false}
      rows={1}
      className={cn(
        "max-h-[calc(5lh+1.5rem)] min-h-0 resize-none overflow-y-auto rounded-none border-0 bg-transparent px-0.5 pt-4 pb-2 shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0 disabled:cursor-default disabled:bg-transparent disabled:opacity-100 dark:bg-transparent dark:disabled:bg-transparent",
        tight && "pt-1",
      )}
    />
  );
}
