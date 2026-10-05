import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Copies the text it's given when clicked; hidden where the clipboard isn't available. */
export function CopyButton({ text }: { text: () => string }) {
  const [copied, setCopied] = useState(false);
  // Missing over plain-HTTP remote access, where the page isn't a secure context.
  const clipboard = navigator.clipboard as Clipboard | undefined;
  if (!clipboard) return null;
  const copy = () =>
    clipboard
      .writeText(text())
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});

  return (
    <Button
      size="icon-xs"
      variant="outline"
      aria-label={copied ? "Copied" : "Copy"}
      onClick={() => void copy()}
    >
      {copied ? <Check /> : <Copy />}
    </Button>
  );
}
