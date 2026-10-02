import { Kbd } from "@/components/agent/Kbd";

/** The command center's key hints. */
export function CommandFooter() {
  return (
    <div className="flex justify-end gap-4 border-t px-4 py-2 text-xs text-muted-foreground max-sm:hidden">
      <span>
        <Kbd>↑↓</Kbd> to move
      </span>
      <span>
        <Kbd>↵</Kbd> to open
      </span>
      <span>
        <Kbd>⌘K</Kbd> or <Kbd>esc</Kbd> to close
      </span>
    </div>
  );
}
