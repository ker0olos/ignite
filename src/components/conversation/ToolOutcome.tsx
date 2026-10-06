import type { ReactNode } from "react";

/** Wraps a tool call's result under a "⎿" elbow, as Claude Code draws it. */
export function ToolOutcome({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2 pl-1 text-muted-foreground">
      {/* Drawn, not the ⎿ glyph: fonts place that glyph at different heights. */}
      <span
        aria-hidden
        className="mt-px h-2 w-1.5 shrink-0 border-b border-l border-current"
      />
      <div className="min-w-0 flex-1 space-y-1.5">{children}</div>
    </div>
  );
}
