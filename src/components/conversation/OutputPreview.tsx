import { useState } from "react";
import { MoreLines } from "@/components/conversation/MoreLines";
import { PREVIEW_LINES } from "@/components/conversation/shared";
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
  const lines = text.replace(/\n+$/, "").split("\n");
  const shown = all ? lines : lines.slice(0, PREVIEW_LINES);
  return (
    <div>
      <pre
        className={cn(
          "font-mono text-[12px] whitespace-pre-wrap [overflow-wrap:anywhere]",
          error && "text-destructive",
        )}
      >
        {shown.join("\n")}
      </pre>
      {lines.length > shown.length && (
        <MoreLines
          count={lines.length - shown.length}
          onClick={() => setAll(true)}
        />
      )}
    </div>
  );
}
