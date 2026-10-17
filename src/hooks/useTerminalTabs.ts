import { useCallback, useEffect, useState } from "react";
import type { TerminalInfo } from "../../shared/terminal";
import type { useTabs } from "@/hooks/useTabs";
import { terminalOf } from "@/lib/childTabs";
import type { HostClient } from "@/lib/piHost";

/** The terminal ids among a list of tab ids. */
function terminalsIn(tabs: string[]) {
  return tabs.flatMap((id) => terminalOf(id) ?? []);
}

function listTerminals(host: HostClient, cwd: string) {
  return host
    .request({ type: "terminal_list", cwd })
    .catch((): TerminalInfo[] => []);
}

const without = (all: Record<string, string[]>, terminal: string) =>
  Object.fromEntries(
    Object.entries(all).map(([cwd, ids]) => [
      cwd,
      ids.filter((id) => id !== terminal),
    ]),
  );

/**
 * The open folders' running terminals, for the sidebar. `closeTab` ends a
 * terminal's shell with its tab only when no command runs in it; otherwise it
 * stays listed until `stop`, which ends it and closes its tab. One that
 * exited is forgotten once no tab shows it.
 */
export function useTerminalTabs(
  host: HostClient | null,
  folders: string[],
  tabs: Pick<ReturnType<typeof useTabs>, "files" | "close">,
) {
  const { files, close } = tabs;
  const [running, setRunning] = useState<Record<string, string[]>>({});
  // null once a push said nothing runs; pushes are newer than any listing in flight.
  const [commands, setCommands] = useState<Record<string, string | null>>({});
  const [exits, setExits] = useState(0);
  const key = folders.join("\n");

  useEffect(
    () =>
      host?.subscribe((m) => {
        if (m.type === "terminal_exit") setExits((n) => n + 1);
        if (m.type === "terminal_command") {
          setCommands((all) => ({ ...all, [m.terminal]: m.command ?? null }));
        }
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
        return [cwd, list.filter((t) => t.running)] as const;
      }),
    ).then((entries) => {
      if (cancelled) return;
      setRunning(
        Object.fromEntries(
          entries.map(([cwd, list]) => [cwd, list.map((t) => t.terminal)]),
        ),
      );
      setCommands((all) =>
        Object.fromEntries(
          entries.flatMap(([, list]) =>
            list.map((t) => [
              t.terminal,
              t.terminal in all ? all[t.terminal] : (t.command ?? null),
            ]),
          ),
        ),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [host, key, files, exits]);

  const stop = useCallback(
    (terminal: string) => {
      for (const id of files) if (terminalOf(id) === terminal) close(id);
      setRunning((all) => without(all, terminal));
      host?.request({ type: "terminal_close", terminal }).catch(() => {});
    },
    [host, files, close],
  );

  const closeTab = useCallback(
    (id: string) => {
      close(id);
      const terminal = terminalOf(id);
      if (!terminal || !host) return;
      host
        .request({ type: "terminal_close_idle", terminal })
        .then((closed) => {
          if (closed) setRunning((all) => without(all, terminal));
        })
        .catch(() => {});
    },
    [host, close],
  );

  const runningIn = useCallback((cwd: string) => running[cwd] ?? [], [running]);
  const command = useCallback(
    (terminal: string): string | undefined => commands[terminal] ?? undefined,
    [commands],
  );
  return { running: runningIn, command, stop, closeTab };
}
