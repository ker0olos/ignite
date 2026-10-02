import { useState } from "react";
import { Check, Copy, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRunInTerminal } from "@/hooks/useRunInTerminal";
import { isShellBlock } from "@/lib/runCommand";

/** Copy, and for shell blocks Run in a new terminal tab, shown on hover over an assistant code block. */
export function CodeBlockActions({
  code,
  lang,
}: {
  code: string;
  lang: string | undefined;
}) {
  const run = useRunInTerminal();
  const [copied, setCopied] = useState(false);
  // Missing over plain-HTTP remote access, where the page isn't a secure context.
  const clipboard = navigator.clipboard as Clipboard | undefined;
  const copy = () =>
    clipboard
      ?.writeText(code)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});

  return (
    <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
      {run && isShellBlock(lang) && (
        <Button
          size="xs"
          variant="outline"
          aria-label="Run in terminal"
          onClick={() => run(code)}
        >
          <Play />
          Run
        </Button>
      )}
      {clipboard && (
        <Button
          size="icon-xs"
          variant="outline"
          aria-label={copied ? "Copied" : "Copy"}
          onClick={() => void copy()}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      )}
    </div>
  );
}
