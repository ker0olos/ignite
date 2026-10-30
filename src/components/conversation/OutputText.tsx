import { useState } from "react";
import { LinkedText } from "@/components/conversation/LinkedText";
import { MoreLines } from "@/components/conversation/MoreLines";
import { PREVIEW_CHARS, PREVIEW_LINES } from "@/components/conversation/shared";
import { isShortOutput, outputPreview } from "@/lib/toolRows";
import { cn } from "@/lib/utils";

/** Formatted tool output as a terminal shows it (one short line as is), a few lines with an expand button. Errors are red. */
export function OutputText({ text, error }: { text: string; error?: boolean }) {
  const [all, setAll] = useState(false);
  const preview = all
    ? { text: text.replace(/\n+$/, ""), hidden: 0 }
    : outputPreview(text, PREVIEW_LINES, PREVIEW_CHARS);
  return (
    <div className="space-y-1">
      <pre
        className={cn(
          "font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-foreground/85 [overflow-wrap:anywhere]",
          !isShortOutput(text) &&
            "rounded-lg border bg-background px-3.5 py-2.5",
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
