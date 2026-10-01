import { useEffect, useRef } from "react";
import { CodeBlock } from "@/components/conversation/CodeBlock";
import { Button } from "@/components/ui/button";
import { useBackgroundOutput } from "@/hooks/useBackgroundOutput";
import { backgroundState } from "@/lib/background";
import type { CodeThemes } from "@/lib/codeThemes";
import type { HostClient } from "@/lib/piHost";
import type { Settings } from "@/lib/settings";

/** A background command, highlighted, and its output as it runs, following the end, with a Stop button while it runs. */
export function BackgroundView({
  session,
  pid,
  command,
  host,
  editor,
  codeThemes,
}: {
  session: string;
  pid: number;
  command: string;
  host: HostClient | null;
  editor: Settings["editor"];
  codeThemes: CodeThemes;
}) {
  const { shown, error, stop } = useBackgroundOutput(host, session, pid);
  const end = useRef<HTMLDivElement>(null);
  const output = shown?.output;

  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [output]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-8 shrink-0 items-center justify-end gap-2 pr-2 pl-4 text-xs text-muted-foreground">
        <span>{backgroundState(shown, pid)}</span>
        {shown?.running && (
          <Button size="xs" variant="outline" onClick={() => void stop()}>
            Stop
          </Button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
        <CodeBlock
          code={command}
          lang="sh"
          editor={editor}
          codeThemes={codeThemes}
          className="terminal wrap mt-0 [&_pre]:w-auto"
        />
        {error ? (
          <p className="text-[13px] text-muted-foreground">{error}</p>
        ) : (
          <pre
            className="text-xs leading-5 whitespace-pre-wrap"
            style={{ fontFamily: editor.font_family }}
          >
            {shown?.truncated && "…\n"}
            {output || (shown && "(no output yet)")}
          </pre>
        )}
        <div ref={end} />
      </div>
    </div>
  );
}
