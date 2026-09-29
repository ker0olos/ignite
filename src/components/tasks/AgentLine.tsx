import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The status card's shell: one rounded row, tinted green when the work is ready. */
export function AgentLine({
  ok,
  children,
}: {
  ok?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs",
        ok ? "bg-success/10" : "bg-muted",
      )}
    >
      {children}
    </div>
  );
}
