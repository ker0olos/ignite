import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { LinkedText } from "@/components/conversation/LinkedText";
import { MoreLines } from "@/components/conversation/MoreLines";
import { PREVIEW_CHARS, PREVIEW_LINES } from "@/components/conversation/shared";
import { isShortOutput, outputPreview } from "@/lib/toolRows";
import { cn } from "@/lib/utils";

/**
 * Plain-text tool output, collapsed to its line count unless it's one short
 * line; opened, a few lines with an expand button. Errors are red.
 */
export function OutputPreview({
  text,
  error,
}: {
  text: string;
  error?: boolean;
}) {
  const [opened, setOpen] = useState(false);
  // Decided on each render: streaming output starts short and grows.
  const open = opened || isShortOutput(text);
  const [all, setAll] = useState(false);
  const trimmed = text.replace(/\n+$/, "");
  const lines = trimmed.split("\n").length;
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className="size-3" />
        {lines} {lines === 1 ? "line" : "lines"} of output
      </button>
    );
  }
  const preview = all
    ? { text: trimmed, hidden: 0 }
    : outputPreview(text, PREVIEW_LINES, PREVIEW_CHARS);
  return (
    <div>
      <pre
        className={cn(
          "font-mono text-[12px] whitespace-pre-wrap [overflow-wrap:anywhere]",
          error && "text-destructive",
        )}
      >
        <LinkedText text={preview.text} />
      </pre>
      {preview.hidden > 0 && (
        <MoreLines count={preview.hidden} onClick={() => setAll(true)} />
      )}
    </div>
  );
}
