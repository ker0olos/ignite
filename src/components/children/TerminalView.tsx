import { useCallback, useEffect } from "react";
import { useTerminalSession } from "@/hooks/useTerminalSession";
import { useXterm } from "@/hooks/useXterm";
import type { HostClient } from "@/lib/piHost";
import type { Settings } from "@/lib/settings";

const INTERACTIVE = { cursorBlink: true };

/** One of the user's terminals: their shell, typed into here. Closing the tab ends it, switching away doesn't. */
export function TerminalView({
  terminal,
  host,
  editor,
}: {
  terminal: string;
  host: HostClient | null;
  editor: Settings["editor"];
}) {
  const resize = useCallback(
    (cols: number, rows: number) =>
      host
        ?.request({ type: "terminal_resize", terminal, cols, rows })
        .catch(() => {}),
    [host, terminal],
  );
  const { host: element, term } = useXterm(
    editor.font_family,
    INTERACTIVE,
    resize,
  );
  useTerminalSession(host, terminal, term);

  useEffect(() => term?.focus(), [term]);

  return (
    <div className="terminal-surface min-h-0 flex-1 px-5 py-4">
      <div ref={element} className="h-full" />
    </div>
  );
}
