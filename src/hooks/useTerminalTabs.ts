import { useEffect, useRef } from "react";
import type { useTabs } from "@/hooks/useTabs";
import { childTabId, readChildTab } from "@/lib/childTabs";
import type { HostClient } from "@/lib/piHost";

/** The terminal ids among a list of tab ids. */
function terminalsIn(tabs: string[]) {
  return tabs.flatMap((id) => {
    const tab = readChildTab(id);
    return tab?.kind === "terminal" ? [tab.terminal] : [];
  });
}

/**
 * Closing a terminal's tab ends its shell. Switching folders drops the tabs
 * but not the shells; showing the folder again reopens their tabs, and
 * forgets those that exited meanwhile.
 */
export function useTerminalTabs(
  host: HostClient | null,
  folder: string,
  tabs: Pick<ReturnType<typeof useTabs>, "files" | "open">,
) {
  const { files, open } = tabs;

  const known = useRef({ folder, terminals: [] as string[] });
  useEffect(() => {
    const now = terminalsIn(files);
    if (known.current.folder === folder) {
      for (const terminal of known.current.terminals) {
        if (!now.includes(terminal)) {
          host?.request({ type: "terminal_close", terminal }).catch(() => {});
        }
      }
    }
    known.current = { folder, terminals: now };
  }, [files, folder, host]);

  useEffect(() => {
    if (!host) return;
    let cancelled = false;
    host
      .request({ type: "terminal_list", cwd: folder })
      .then((list) => {
        if (cancelled) return;
        for (const { terminal, running } of list) {
          if (running) {
            open(childTabId({ kind: "terminal", session: "", terminal }));
          } else {
            host.request({ type: "terminal_close", terminal }).catch(() => {});
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [host, folder, open]);
}
