import { useEffect } from "react";
import { useXterm } from "@/hooks/useXterm";

const READ_ONLY = {
  convertEol: true,
  disableStdin: true,
  cursorBlink: false,
};

/** Text as a terminal: monospace on the app background, with an optional block cursor at the end. */
export function TerminalSurface({
  text,
  cursor,
  fontFamily,
}: {
  text: string;
  cursor: boolean;
  fontFamily: string;
}) {
  const { host, term } = useXterm(fontFamily, READ_ONLY);

  useEffect(() => {
    if (!term) return;
    term.reset();
    // xterm draws no cursor until focused; leaving the alt screen (a no-op here) initializes it
    term.write(text + (cursor ? "\x1b[?47l\x1b[?25h" : "\x1b[?25l"), () =>
      term.scrollToBottom(),
    );
  }, [term, text, cursor]);

  return (
    <div className="terminal-surface min-h-0 flex-1 px-5 py-4">
      <div ref={host} className="h-full" />
    </div>
  );
}
