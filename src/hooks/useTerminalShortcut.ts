import { useEffect } from "react";
import type { WorkspaceView } from "@/components/app/ViewSwitch";
import type { useTabs } from "@/hooks/useTabs";
import { useTerminalTabs } from "@/hooks/useTerminalTabs";
import { childTabId } from "@/lib/childTabs";
import type { HostClient } from "@/lib/piHost";

/**
 * ⌘1 (Ctrl+1, with or without Shift) opens a new terminal tab in the folder
 * while the chat shows, with or without a conversation yet; see
 * useTerminalTabs for how they close and come back.
 */
export function useTerminalShortcut(
  host: HostClient | null,
  folder: string,
  shown: string | null,
  view: WorkspaceView,
  tabs: Pick<ReturnType<typeof useTabs>, "files" | "open">,
) {
  const { open } = tabs;

  useEffect(() => {
    if (!host || view !== "chat") return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      if (e.code !== "Digit1") return;
      e.preventDefault();
      host
        .request({ type: "terminal_open", cwd: folder, cols: 80, rows: 24 })
        .then(({ terminal }) =>
          // A new chat has no conversation until its first message.
          open(
            childTabId({ kind: "terminal", session: shown ?? "", terminal }),
          ),
        )
        .catch((e: Error) => console.error("terminal_open:", e.message));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [host, folder, shown, view, open]);

  useTerminalTabs(host, folder, tabs);
}
