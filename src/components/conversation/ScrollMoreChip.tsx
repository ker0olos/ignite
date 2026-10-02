import { ChevronDown } from "lucide-react";

/** A chip over a scrolling list's bottom edge: how many rows are below, scrolling down a page. */
export function ScrollMoreChip({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[11px] text-muted-foreground shadow-sm hover:text-foreground"
    >
      {count} more
      <ChevronDown className="size-3" />
    </button>
  );
}
