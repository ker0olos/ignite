import type { KeyboardEvent, Ref } from "react";
import type { ImageContent } from "../../../shared/agentTypes";
import { Textarea } from "@/components/ui/textarea";
import { typedText } from "@/lib/demo";
import { pastedImages } from "@/lib/images";

/** The composer's text: tells where the caret is, and attaches pasted images. */
export function ComposerInput({
  ref,
  value,
  onChange,
  onCaret,
  onImages,
  onKeyDown,
}: {
  ref: Ref<HTMLTextAreaElement>;
  value: string;
  onChange: (text: string) => void;
  onCaret: (caret: number) => void;
  onImages: (images: ImageContent[]) => void;
  onKeyDown: (e: KeyboardEvent) => void;
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
        const { clipboardData } = e;
        if (clipboardData.files.length === 0) return;
        e.preventDefault();
        void pastedImages(clipboardData).then(onImages);
      }}
      onKeyDown={onKeyDown}
      placeholder="Describe a task"
      autoCorrect="off"
      autoCapitalize="off"
      autoComplete="off"
      spellCheck={false}
      rows={1}
      className="max-h-[calc(5lh+1.5rem)] min-h-0 resize-none overflow-y-auto rounded-none border-0 bg-transparent px-0.5 pt-4 pb-2 shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0 disabled:cursor-default disabled:bg-transparent disabled:opacity-100 dark:bg-transparent dark:disabled:bg-transparent"
    />
  );
}
