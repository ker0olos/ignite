import { useEffect } from "react";
import type { HostClient } from "@/lib/piHost";

/** The part of an xterm a terminal's session drives. */
export type TerminalIO = {
  write(data: string): void;
  onData(cb: (data: string) => void): { dispose(): void };
};

/**
 * Connects a view to a host terminal: writes its snapshot, then live output,
 * and sends keystrokes. Output that arrives before the snapshot does is
 * already in it, so it is dropped.
 */
export function useTerminalSession(
  host: HostClient | null,
  terminal: string,
  io: TerminalIO | null,
) {
  useEffect(() => {
    if (!host || !io) return;
    let cancelled = false;
    let restored = false;
    let exited: number | null = null;
    const writeExit = (code: number) =>
      io.write(`\r\n\x1b[2m[exited ${code}]\x1b[0m`);

    const unsubscribe = host.subscribe((m) => {
      if (m.type === "terminal_data" && m.terminal === terminal) {
        if (restored) io.write(m.data);
      } else if (m.type === "terminal_exit" && m.terminal === terminal) {
        exited = m.exitCode;
        if (restored) writeExit(m.exitCode);
      }
    });
    host
      .request({ type: "terminal_snapshot", terminal })
      .then(({ screen, exitCode }) => {
        if (cancelled) return;
        io.write(screen);
        restored = true;
        exited ??= exitCode ?? null;
        if (exited !== null) writeExit(exited);
      })
      .catch((e: Error) => {
        if (!cancelled) io.write(`\x1b[31m${e.message}\x1b[0m`);
      });
    const input = io.onData((data) => {
      if (exited !== null) return;
      host.request({ type: "terminal_input", terminal, data }).catch(() => {});
    });
    return () => {
      cancelled = true;
      unsubscribe();
      input.dispose();
    };
  }, [host, terminal, io]);
}
