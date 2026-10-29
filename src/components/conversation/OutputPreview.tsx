import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { formatOutput, outputRecords } from "@/lib/outputFormat";
import { OutputText } from "@/components/conversation/OutputText";
import { OutputViews } from "@/components/conversation/OutputViews";
import { isShortOutput } from "@/lib/toolRows";

/**
 * Plain-text tool output, collapsed to "Output" unless it's one short line;
 * opened, a few lines with an expand button, or a table when it holds JSON
 * records. Errors are red.
 */
export function OutputPreview({
  text,
  error,
  label,
}: {
  text: string;
  error?: boolean;
  /** Shown collapsed in place of "Output", however short the output. */
  label?: string;
}) {
  const [opened, setOpen] = useState(false);
  // Decided on each render: streaming output starts short and grows.
  const short = isShortOutput(text);
  const open = opened || (!label && short);
  const formatted = useMemo(
    () => (open ? formatOutput(text) : ""),
    [open, text],
  );
  // A one-line answer like {"ok":true} reads fine as text.
  const records = useMemo(
    () => (open && !short ? outputRecords(text) : undefined),
    [open, short, text],
  );
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className="size-3" />
        {label ?? "Output"}
      </button>
    );
  }
  if (records && !error) {
    return <OutputViews text={formatted} records={records} />;
  }
  return <OutputText text={formatted} error={error} />;
}
