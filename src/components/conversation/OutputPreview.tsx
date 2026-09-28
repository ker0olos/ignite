import { useState } from "react";
import { MoreLines } from "@/components/conversation/MoreLines";
import { PREVIEW_CHARS, PREVIEW_LINES } from "@/components/conversation/shared";
import { outputPreview } from "@/lib/toolRows";
import { cn } from "@/lib/utils";

/** Plain-text tool output, truncated to a few lines with an expand button. */
export function OutputPreview({
  text,
  error,
}: {
  text: string;
  error?: boolean;
}) {
  const [all, setAll] = useState(false);
  const preview = all
    ? { text: text.replace(/\n+$/, ""), hidden: 0 }
    : outputPreview(text, PREVIEW_LINES, PREVIEW_CHARS);
  return (
    <div>
      <pre
        className={cn(
          "font-mono text-[12px] whitespace-pre-wrap [overflow-wrap:anywhere]",
          error && "text-destructive",
        )}
      >
        {preview.text}
      </pre>
      {preview.hidden > 0 && (
        <MoreLines count={preview.hidden} onClick={() => setAll(true)} />
      )}
    </div>
  );
}
