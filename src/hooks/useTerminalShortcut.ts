import { useCallback, useEffect } from "react";
import type { WorkspaceView } from "@/components/app/ViewSwitch";
import type { useTabs } from "@/hooks/useTabs";
import { childTabId, startingTerminalTab } from "@/lib/childTabs";
import type { HostClient } from "@/lib/piHost";
import { terminalInput } from "@/lib/runCommand";

/** ⌘J or ⌘1 (or Ctrl, with or without Shift) opens a terminal tab in the shown conversation's worktree, starting at once; returns run-in-terminal. */
export function useTerminalShortcut(
  host: HostClient | null,
  folder: string,
  dir: string,
  /** The shown conversation, whose worktree the sidecar waits for (null: none yet; undefined: the one it's showing). */
  session: string | null | undefined,
  view: WorkspaceView,
  tabs: Pick<
    ReturnType<typeof useTabs>,
    "open" | "rename" | "closeEverywhere" | "isOpen"
  >,
) {
  const { open, rename, closeEverywhere, isOpen } = tabs;

  const openTerminal = useCallback(
    (command?: string) => {
      if (!host) return;
      const standIn = startingTerminalTab();
      open(standIn);
      host
        .request({
          type: "terminal_open",
          cwd: folder,
          dir,
          ...(session !== undefined && { session }),
          cols: 80,
          rows: 24,
        })
        .then(({ terminal }) => {
          // Its tab was closed while it started: so is the shell, and nothing runs.
          if (!isOpen(standIn))
            return host.request({ type: "terminal_close", terminal });
          rename(
            standIn,
            childTabId({ kind: "terminal", session: "", terminal }),
          );
          if (command === undefined) return;
          const data = terminalInput(command);
          return host.request({ type: "terminal_input", terminal, data });
        })
        .catch((e: Error) => {
          closeEverywhere(standIn);
          console.error("terminal_open:", e.message);
        });
    },
    [host, folder, dir, session, open, rename, closeEverywhere, isOpen],
  );

  useEffect(() => {
    if (!host || view !== "conversation") return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      // J by its letter, so any layout's J; 1 by its key, since Shift turns it into "!".
      if (e.key.toLowerCase() !== "j" && e.code !== "Digit1") return;
      e.preventDefault();
      openTerminal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [host, view, openTerminal]);

  return host ? openTerminal : null;
}
