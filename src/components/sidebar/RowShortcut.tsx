import { shortcut } from "@/lib/approvalKeys";

/** A sidebar row's ⌘ digit, over its buttons until the row is hovered or focused. */
export function RowShortcut({ digit }: { digit: number }) {
  return (
    <span className="pointer-events-none absolute inset-y-0 right-1 flex items-center text-[13px] text-muted-foreground group-hover:opacity-0 group-has-[:focus-visible]:opacity-0 pointer-coarse:hidden">
      {shortcut(String(digit))}
    </span>
  );
}
