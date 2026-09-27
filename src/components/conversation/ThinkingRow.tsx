import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Collapsed "Thinking" disclosure; expands to show the reasoning text. */
export function ThinkingRow({ thinking }: { thinking: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronRight
          className={cn("size-3 transition-transform", open && "rotate-90")}
        />
        Thinking
      </button>
      {open && (
        <p className="mt-1 pl-4 text-xs whitespace-pre-wrap text-muted-foreground">
          {thinking}
        </p>
      )}
    </div>
  );
}
