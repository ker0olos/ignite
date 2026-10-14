import { Undo2 } from "lucide-react";

/** Discards a file's changes; shown while its row is hovered or focused. */
export function RevertButton({
  path,
  onRevert,
}: {
  path: string;
  onRevert: () => void;
}) {
  return (
    <button
      type="button"
      title="Discard changes"
      aria-label={`Discard changes in ${path}`}
      onClick={(e) => {
        e.stopPropagation();
        onRevert();
      }}
      className="hidden shrink-0 text-muted-foreground outline-none group-focus-within:block group-hover:block hover:text-foreground [@media(hover:none)]:block"
    >
      <Undo2 className="size-3.5" />
    </button>
  );
}
