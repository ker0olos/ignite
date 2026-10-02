import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { CompactionProgress } from "@/components/conversation/CompactionProgress";
import { tokenCount, type CompactionItem } from "@/lib/compaction";
import { cn } from "@/lib/utils";

/** Compaction: its progress while it runs, then a divider with the summary that replaced the older messages. */
export function CompactionRow({ row }: { row: CompactionItem }) {
  const [open, setOpen] = useState(false);
  const { summary, tokensBefore } = row;
  if (summary === undefined)
    return <CompactionProgress written={row.written} />;
  return (
    <div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-1 outline-none hover:text-foreground focus-visible:text-foreground"
        >
          <ChevronRight
            className={cn("size-3 transition-transform", open && "rotate-90")}
          />
          Compacted
          {tokensBefore !== undefined && ` ${tokenCount(tokensBefore)} tokens`}
        </button>
        <span className="h-px flex-1 bg-border" />
      </div>
      {open && summary && (
        <p className="mt-2 text-xs whitespace-pre-wrap text-muted-foreground">
          {summary}
        </p>
      )}
    </div>
  );
}
