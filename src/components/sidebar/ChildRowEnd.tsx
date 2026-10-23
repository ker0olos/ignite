import type { LucideIcon } from "lucide-react";
import { RowShortcut } from "@/components/sidebar/RowShortcut";

/** A child row's end: its ⌘ digit (a fork's), and its stop or clear button on hover. */
export function ChildRowEnd({
  action,
  shortcut,
}: {
  action?: { label: string; icon: LucideIcon; run: () => void };
  shortcut?: number;
}) {
  if (!action && shortcut === undefined) return null;
  return (
    <div className="relative mr-1 flex shrink-0 items-center">
      {shortcut !== undefined && <RowShortcut digit={shortcut} />}
      {action ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            action.run();
          }}
          aria-label={action.label}
          title={action.label}
          className="shrink-0 rounded-md p-1 opacity-0 hover:bg-foreground/10 focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
        >
          <action.icon className="size-3 text-muted-foreground" />
        </button>
      ) : (
        <span className="size-5" />
      )}
    </div>
  );
}
