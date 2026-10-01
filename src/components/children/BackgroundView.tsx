import { TerminalSurface } from "@/components/terminal/TerminalSurface";
import { Button } from "@/components/ui/button";
import { useBackgroundOutput } from "@/hooks/useBackgroundOutput";
import { backgroundState, promptLine } from "@/lib/background";
import type { HostClient } from "@/lib/piHost";
import type { Settings } from "@/lib/settings";

/** A background command and its output as a terminal, with its state and a Stop button while it runs. */
export function BackgroundView({
  session,
  pid,
  command,
  host,
  editor,
}: {
  session: string;
  pid: number;
  command: string;
  host: HostClient | null;
  editor: Settings["editor"];
}) {
  const { shown, error, stop } = useBackgroundOutput(host, session, pid);
  const text = error
    ? error
    : `${promptLine(command)}\r\n${shown?.truncated ? "…\r\n" : ""}${shown?.output ?? ""}`;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <TerminalSurface
        text={text}
        cursor={shown?.running ?? false}
        fontFamily={editor.font_family}
      />
      <div className="absolute top-2 right-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{backgroundState(shown, pid)}</span>
        {shown?.running && (
          <Button size="xs" variant="outline" onClick={() => void stop()}>
            Stop
          </Button>
        )}
      </div>
    </div>
  );
}
