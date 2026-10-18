import { Plus } from "lucide-react";

/** A diff row's "+", shown on hover: pressed (and dragged, or shift-pressed) it takes rows for a comment. */
export function DiffCommentButton({
  onPress,
  onOpen,
}: {
  onPress: (shift: boolean) => void;
  /** Pressed from the keyboard. */
  onOpen: () => void;
}) {
  return (
    <span className="flex w-5 shrink-0 justify-center">
      <button
        type="button"
        aria-label="Comment on this line"
        title="Comment (shift-click or drag for more lines)"
        className="flex size-4 items-center justify-center rounded-sm bg-primary text-primary-foreground opacity-0 outline-none group-hover/line:opacity-100 focus-visible:opacity-100"
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          // Keeps the drag from selecting text.
          e.preventDefault();
          onPress(e.shiftKey);
        }}
        onClick={(e) => e.detail === 0 && onOpen()}
      >
        <Plus className="size-3" />
      </button>
    </span>
  );
}
