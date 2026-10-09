import { Play } from "lucide-react";
import { CopyButton } from "@/components/conversation/CopyButton";
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

  return (
    <div className="absolute top-1 right-1 flex gap-1 rounded-md bg-background opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
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
      <CopyButton text={() => code} />
    </div>
  );
}
