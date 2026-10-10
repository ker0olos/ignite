import { useCallback, useEffect, useState } from "react";
import type { TerminalInfo } from "../../shared/terminal";
import type { useTabs } from "@/hooks/useTabs";
import { readChildTab } from "@/lib/childTabs";
import type { HostClient } from "@/lib/piHost";

/** The terminal ids among a list of tab ids. */
function terminalsIn(tabs: string[]) {
  return tabs.flatMap((id) => {
    const tab = readChildTab(id);
    return tab?.kind === "terminal" ? [tab.terminal] : [];
  });
}

function listTerminals(host: HostClient, cwd: string) {
  return host
    .request({ type: "terminal_list", cwd })
    .catch((): TerminalInfo[] => []);
}

/**
 * The open folders' running terminals, for the sidebar. Closing a terminal's
 * tab leaves its shell running; `stop` ends it and closes its tab. One that
 * exited is forgotten once no tab shows it.
 */
export function useTerminalTabs(
  host: HostClient | null,
  folders: string[],
  tabs: Pick<ReturnType<typeof useTabs>, "files" | "close">,
) {
  const { files, close } = tabs;
  const [running, setRunning] = useState<Record<string, string[]>>({});
  const [exits, setExits] = useState(0);
  const key = folders.join("\n");

  useEffect(
    () =>
      host?.subscribe((m) => {
        if (m.type === "terminal_exit") setExits((n) => n + 1);
      }),
    [host],
  );

  useEffect(() => {
    if (!host) return;
    let cancelled = false;
    const shown = terminalsIn(files);
    void Promise.all(
      (key ? key.split("\n") : []).map(async (cwd) => {
        const list = await listTerminals(host, cwd);
        for (const t of list) {
          if (!t.running && !shown.includes(t.terminal)) {
            host
              .request({ type: "terminal_close", terminal: t.terminal })
              .catch(() => {});
          }
        }
        return [cwd, list.filter((t) => t.running).map((t) => t.terminal)];
      }),
    ).then((entries) => {
      if (!cancelled) setRunning(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [host, key, files, exits]);

  const stop = useCallback(
    (terminal: string) => {
      for (const id of files) {
        const tab = readChildTab(id);
        if (tab?.kind === "terminal" && tab.terminal === terminal) close(id);
      }
      setRunning((all) =>
        Object.fromEntries(
          Object.entries(all).map(([cwd, ids]) => [
            cwd,
            ids.filter((id) => id !== terminal),
          ]),
        ),
      );
      host?.request({ type: "terminal_close", terminal }).catch(() => {});
    },
    [host, files, close],
  );

  const runningIn = useCallback((cwd: string) => running[cwd] ?? [], [running]);
  return { running: runningIn, stop };
}
