import { useCallback, useEffect, useState } from "react";
import type { TerminalInfo } from "../../shared/terminal";
import type { useTabs } from "@/hooks/useTabs";
import { terminalOf, type TerminalLabel } from "@/lib/childTabs";
import { confirmCloseTerminal } from "@/lib/lifecycle";
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
 * terminal with its tab, asking first when a command still runs in it; `stop`
 * ends one from the sidebar. One that exited is forgotten once no tab shows it.
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
  const [names, setNames] = useState<Record<string, string>>({});
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
        return [cwd, list] as const;
      }),
    ).then((listed) => {
      if (cancelled) return;
      setNames(
        Object.fromEntries(
          listed.flatMap(([, list]) => list.map((t) => [t.terminal, t.name])),
        ),
      );
      const entries = listed.map(
        ([cwd, list]) => [cwd, list.filter((t) => t.running)] as const,
      );
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
    async (id: string) => {
      const terminal = terminalOf(id);
      if (!terminal || !host) return close(id);
      const idle = await host
        .request({ type: "terminal_close_idle", terminal })
        // Unchecked counts as busy: ask, then end it, never leave it running unlisted.
        .catch(() => false);
      const command = commands[terminal] ?? undefined;
      if (!idle && !(await confirmCloseTerminal(command))) return;
      close(id);
      setRunning((all) => without(all, terminal));
      if (!idle)
        host.request({ type: "terminal_close", terminal }).catch(() => {});
    },
    [host, close, commands],
  );

  const runningIn = useCallback((cwd: string) => running[cwd] ?? [], [running]);
  const label = useCallback(
    (terminal: string): TerminalLabel => ({
      name: names[terminal],
      command: commands[terminal] ?? undefined,
    }),
    [names, commands],
  );
  return { running: runningIn, label, stop, closeTab };
}
