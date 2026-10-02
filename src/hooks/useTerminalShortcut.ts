import { useCallback, useEffect } from "react";
import type { WorkspaceView } from "@/components/app/ViewSwitch";
import type { useTabs } from "@/hooks/useTabs";
import { useTerminalTabs } from "@/hooks/useTerminalTabs";
import { childTabId } from "@/lib/childTabs";
import type { HostClient } from "@/lib/piHost";
import { terminalInput } from "@/lib/runCommand";

/**
 * ⌘1 (Ctrl+1, with or without Shift) opens a new terminal tab in the folder
 * while the conversation shows, with or without a conversation yet; see
 * useTerminalTabs for how they close and come back. Returns a function that
 * opens one and runs a command in it, or null with no sidecar.
 */
export function useTerminalShortcut(
  host: HostClient | null,
  folder: string,
  shown: string | null,
  view: WorkspaceView,
  tabs: Pick<ReturnType<typeof useTabs>, "files" | "open">,
) {
  const { open } = tabs;

  const openTerminal = useCallback(
    (command?: string) => {
      if (!host) return;
      host
        .request({ type: "terminal_open", cwd: folder, cols: 80, rows: 24 })
        .then(({ terminal }) => {
          // A new conversation has no conversation until its first message.
          open(
            childTabId({ kind: "terminal", session: shown ?? "", terminal }),
          );
          if (command === undefined) return;
          const data = terminalInput(command);
          return host.request({ type: "terminal_input", terminal, data });
        })
        .catch((e: Error) => console.error("terminal_open:", e.message));
    },
    [host, folder, shown, open],
  );

  useEffect(() => {
    if (!host || view !== "conversation") return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      if (e.code !== "Digit1") return;
      e.preventDefault();
      openTerminal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [host, view, openTerminal]);

  useTerminalTabs(host, folder, tabs);
  return host ? openTerminal : null;
}
