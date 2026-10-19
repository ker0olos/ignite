import { useCallback, useEffect } from "react";
import type { WorkspaceView } from "@/components/app/ViewSwitch";
import type { useTabs } from "@/hooks/useTabs";
import { childTabId, startingTerminalTab } from "@/lib/childTabs";
import type { HostClient } from "@/lib/piHost";
import { terminalInput } from "@/lib/runCommand";

/**
 * ⌘J or ⌘1 (or Ctrl, with or without Shift) opens a new terminal tab in `dir`
 * (the shown conversation's worktree), listed under `folder`, while the
 * conversation shows, with or without a conversation yet. Its tab shows at
 * once, starting, until the sidecar has the shell. Returns a function that
 * opens one and runs a command in it, or null with no sidecar.
 */
export function useTerminalShortcut(
  host: HostClient | null,
  folder: string,
  dir: string,
  /** The shown conversation, whose worktree the sidecar waits for while it opens. */
  session: string | null,
  view: WorkspaceView,
  tabs: Pick<ReturnType<typeof useTabs>, "open" | "rename" | "closeEverywhere">,
) {
  const { open, rename, closeEverywhere } = tabs;

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
          ...(session && { session }),
          cols: 80,
          rows: 24,
        })
        .then(({ terminal }) => {
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
    [host, folder, dir, session, open, rename, closeEverywhere],
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
