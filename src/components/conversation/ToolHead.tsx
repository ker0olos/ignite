import { useState, type ReactNode } from "react";
import { ArgPath } from "@/components/conversation/ArgPath";
import { splitPaths } from "@/lib/fileLinks";
import { cn } from "@/lib/utils";

/** A tool call's title line: its title, an MCP server's name, and its argument, shown in full when clicked. */
export function ToolHead({
  title,
  server,
  arg,
  folder,
  muted,
}: {
  /** None for a call under its tool's shared tile, which names it. */
  title?: ReactNode;
  server?: string;
  arg: string;
  folder: string;
  /** A call that never ran. */
  muted?: boolean;
}) {
  const [full, setFull] = useState(false);
  const parts = splitPaths(arg).map((part, i) =>
    part.path ? (
      <ArgPath key={i} text={part.text} folder={folder} />
    ) : (
      part.text
    ),
  );
  return (
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
      {title && (
        <span
          className={cn(
            "shrink-0 text-[14px] font-semibold text-foreground",
            muted && "font-medium text-muted-foreground",
          )}
        >
          {title}
        </span>
      )}
      {server && (
        <span className="shrink-0 text-[13px] text-muted-foreground">
          {server}
        </span>
      )}
      {arg && (
        <button
          type="button"
          aria-expanded={full}
          onClick={() => setFull(!full)}
          className={cn(
            "min-w-0 cursor-pointer text-left font-mono [overflow-wrap:anywhere]",
            // Without a title the argument is the step's heading.
            title
              ? "text-[12px] text-muted-foreground"
              : "text-[12.5px] text-foreground/90",
            // A long command (a heredoc) wraps to three lines until clicked.
            full ? "whitespace-pre-wrap" : "line-clamp-3",
          )}
        >
          {parts}
        </button>
      )}
    </div>
  );
}
