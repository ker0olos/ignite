import type { ReactNode } from "react";

/** A small keyboard-shortcut hint, e.g. inside the send button. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border px-1 font-sans text-[11px] text-muted-foreground">
      {children}
    </kbd>
  );
}
