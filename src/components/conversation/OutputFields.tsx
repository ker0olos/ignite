import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { OutputValue } from "@/components/conversation/OutputValue";
import type { OutputRecord } from "@/lib/outputFormat";

/** One record at a time as key and value lines, with arrows between records. */
export function OutputFields({ records }: { records: OutputRecord[] }) {
  const [picked, setIndex] = useState(0);
  // Output that streams on can hold fewer records than the one picked.
  const index = Math.min(picked, records.length - 1);
  const step = (by: number) =>
    setIndex((index + by + records.length) % records.length);
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-center bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
        Row {index + 1} of {records.length}
        {records.length > 1 && (
          <span className="ml-auto flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous row"
              onClick={() => step(-1)}
              className="hover:text-foreground"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="Next row"
              onClick={() => step(1)}
              className="hover:text-foreground"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </span>
        )}
      </div>
      <div className="py-1">
        {Object.entries(records[index]).map(([key, value]) => (
          <div key={key} className="flex gap-1.5 px-3 py-0.5 text-[12px]">
            <span className="w-40 shrink-0 truncate text-muted-foreground">
              {key}
            </span>
            <span className="[overflow-wrap:anywhere]">
              <OutputValue value={value} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
