import { useState, type ReactNode } from "react";
import { StatusDot } from "@/components/conversation/StatusDot";
import type { ToolRun } from "@/lib/transcript";
import { cn } from "@/lib/utils";

/** A tool call's title line: status dot, name, and its argument, shown in full when clicked. */
export function ToolHead({
  run,
  title,
  arg,
}: {
  run: ToolRun | undefined;
  title: ReactNode;
  arg: string;
}) {
  const [full, setFull] = useState(false);
  const label = (
    <>
      <span className="font-semibold">{title}</span>
      {arg && (
        <span className="font-mono text-[12px] text-muted-foreground">
          ({arg})
        </span>
      )}
    </>
  );
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span className="flex h-[1lh] items-center">
        <StatusDot run={run} />
      </span>
      {arg ? (
        <button
          type="button"
          aria-expanded={full}
          onClick={() => setFull(!full)}
          className={cn(
            "min-w-0 cursor-pointer text-left",
            full ? "whitespace-pre-wrap [overflow-wrap:anywhere]" : "truncate",
          )}
        >
          {label}
        </button>
      ) : (
        <span className="min-w-0 truncate">{label}</span>
      )}
    </div>
  );
}
