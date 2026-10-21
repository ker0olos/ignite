import { useState, type ReactNode } from "react";
import { Terminal } from "lucide-react";
import { ArgPath } from "@/components/conversation/ArgPath";
import { splitPaths } from "@/lib/fileLinks";
import { shellVerb } from "@/lib/toolRows";
import type { ToolRun } from "@/lib/transcript";
import { cn } from "@/lib/utils";

/** A bash call as a card: its command, shown in full when clicked, with the outcome beneath. */
export function ShellCard({
  run,
  command,
  background,
  folder,
  children,
}: {
  run: ToolRun | undefined;
  command: string;
  background: boolean;
  folder: string;
  children?: ReactNode;
}) {
  const [full, setFull] = useState(false);
  const verb = shellVerb(run, background);
  const tone = verb === "Failed" ? "text-destructive" : "text-muted-foreground";
  return (
    <div className="rounded-lg border bg-card/50 px-3 py-2 text-[13px] text-foreground">
      <div className="flex min-w-0 items-start gap-2">
        <span className="flex h-[1lh] items-center">
          <Terminal className={cn("size-3.5", tone)} />
        </span>
        <button
          type="button"
          aria-expanded={full}
          onClick={() => setFull(!full)}
          className={cn(
            "min-w-0 cursor-pointer text-left",
            full ? "whitespace-pre-wrap [overflow-wrap:anywhere]" : "truncate",
          )}
        >
          <span className={cn("mr-2", tone)}>{verb}</span>
          <span className="font-mono text-[12px]">
            {splitPaths(command).map((part, i) =>
              part.path ? (
                <ArgPath key={i} text={part.text} folder={folder} />
              ) : (
                part.text
              ),
            )}
          </span>
        </button>
      </div>
      {children && (
        <div className="mt-1.5 space-y-1.5 pl-5.5 text-muted-foreground">
          {children}
        </div>
      )}
    </div>
  );
}
