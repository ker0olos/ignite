import { ChevronsUpDown } from "lucide-react";

/** A run of unchanged lines folded away in a diff; clicking shows them. */
export function FoldedLines({
  count,
  onExpand,
}: {
  count: number;
  onExpand: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onExpand}
      className="flex w-full items-center gap-2 bg-muted/60 py-0.5 pl-4 text-left text-muted-foreground select-none hover:bg-muted hover:text-foreground"
    >
      <ChevronsUpDown className="size-3.5" />
      {count} unchanged lines
    </button>
  );
}
