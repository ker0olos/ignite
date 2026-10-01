import { FitAddon } from "@xterm/addon-fit";
import { Terminal, type ITerminalOptions } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, useState } from "react";
import { terminalTheme } from "@/lib/terminalTheme";

/**
 * An xterm in the returned `host` element: fitted to it, themed like the app
 * (and re-themed when dark mode toggles), disposed on unmount. `onResize`
 * runs with the size after each fit; `options` are read when it is created.
 */
export function useXterm(
  fontFamily: string,
  options: ITerminalOptions,
  onResize?: (cols: number, rows: number) => void,
) {
  const host = useRef<HTMLDivElement>(null);
  const [term, setTerm] = useState<Terminal | null>(null);
  const latest = useRef({ options, onResize });

  useEffect(() => {
    latest.current = { options, onResize };
  });

  useEffect(() => {
    const t = new Terminal({
      cursorStyle: "block",
      cursorInactiveStyle: "block",
      fontSize: 13,
      lineHeight: 1.4,
      scrollback: 5000,
      allowTransparency: false,
      ...latest.current.options,
      fontFamily,
      theme: terminalTheme(),
    });
    const fit = new FitAddon();
    t.loadAddon(fit);
    t.open(host.current!);
    const refit = () => {
      fit.fit();
      latest.current.onResize?.(t.cols, t.rows);
    };
    refit();
    setTerm(t);
    const resize = new ResizeObserver(refit);
    resize.observe(host.current!);
    const dark = new MutationObserver(() => {
      t.options.theme = terminalTheme();
    });
    dark.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => {
      resize.disconnect();
      dark.disconnect();
      t.dispose();
      setTerm(null);
    };
  }, [fontFamily]);

  return { host, term };
}
