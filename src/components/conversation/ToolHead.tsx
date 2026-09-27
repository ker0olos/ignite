import type { ReactNode } from "react";
import { StatusDot } from "@/components/conversation/StatusDot";
import type { ToolRun } from "@/lib/transcript";

/** A tool call's title line: status dot, name, and its argument. */
export function ToolHead({
  run,
  title,
  arg,
}: {
  run: ToolRun | undefined;
  title: ReactNode;
  arg: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <StatusDot run={run} />
      <span className="min-w-0 truncate">
        <span className="font-semibold">{title}</span>
        {arg && (
          <span className="font-mono text-[12px] text-muted-foreground">
            ({arg})
          </span>
        )}
      </span>
    </div>
  );
}
