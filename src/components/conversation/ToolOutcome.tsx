import type { ReactNode } from "react";

/** Wraps a tool call's result under the "⎿" marker, as Claude Code draws it. */
export function ToolOutcome({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2 pl-0.5 text-muted-foreground">
      <span className="select-none">⎿</span>
      <div className="min-w-0 flex-1 space-y-1.5">{children}</div>
    </div>
  );
}
