import { useState } from "react";
import { LinkedText } from "@/components/conversation/LinkedText";
import { MoreLines } from "@/components/conversation/MoreLines";
import { PREVIEW_CHARS, PREVIEW_LINES } from "@/components/conversation/shared";
import { outputPreview } from "@/lib/toolRows";
import { cn } from "@/lib/utils";

/** Formatted tool output as text, a few lines with an expand button. Errors are red. */
export function OutputText({ text, error }: { text: string; error?: boolean }) {
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
        <LinkedText text={preview.text} />
      </pre>
      {preview.hidden > 0 && (
        <MoreLines count={preview.hidden} onClick={() => setAll(true)} />
      )}
    </div>
  );
}
