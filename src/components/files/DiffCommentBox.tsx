import { useState } from "react";
import { Button } from "@/components/ui/button";

/** The box a comment is written or edited in: ⌘↵ or Ctrl+↵ saves, Esc cancels. */
export function DiffCommentBox({
  initial = "",
  onSave,
  onCancel,
}: {
  initial?: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial);
  const empty = !text.trim();
  const save = () => !empty && onSave(text.trim());
  return (
    <div className="sticky left-0 w-full max-w-xl space-y-2 px-3 py-2 font-sans text-[13px] leading-normal">
      <textarea
        autoFocus
        value={text}
        placeholder="Comment for the agent"
        aria-label="Comment"
        className="field-sizing-content min-h-16 w-full resize-none rounded-md border bg-background px-2.5 py-2 outline-none placeholder:text-muted-foreground focus-visible:border-ring"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onCancel();
          } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            save();
          }
        }}
      />
      <div className="flex justify-end gap-1.5">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" disabled={empty} onClick={save}>
          {initial ? "Save" : "Comment"}
        </Button>
      </div>
    </div>
  );
}
