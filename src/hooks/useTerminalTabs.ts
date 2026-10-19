import { useCallback, useEffect, useRef, useState } from "react";
import type { TerminalInfo } from "../../shared/terminal";
import type { useTabs } from "@/hooks/useTabs";
import { terminalOf, type TerminalLabel } from "@/lib/childTabs";
import { confirmCloseTerminal } from "@/lib/lifecycle";
import type { HostClient } from "@/lib/piHost";

/** The terminal ids among a list of tab ids. */
function terminalsIn(tabs: string[]) {
  return tabs.flatMap((id) => terminalOf(id) ?? []);
}

/** Tabs of terminals their folder (in `homes`, as last listed) no longer lists, e.g. ended with their conversation's worktree. */
function goneTabs(
  files: string[],
  read: (readonly [string, TerminalInfo[]])[],
  homes: Record<string, string>,
) {
  const known = new Set(
    read.flatMap(([, list]) => list.map((t) => t.terminal)),
  );
  const readIn = new Set(read.map(([cwd]) => cwd));
  return files.filter((id) => {
    const terminal = terminalOf(id);
    return (
      terminal !== null && readIn.has(homes[terminal]) && !known.has(terminal)
    );
  });
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
 * terminal with its tab (in every conversation), asking first when a command
 * still runs in it; `stop` ends one from the sidebar. One that exited is
 * forgotten once no conversation's tab shows it.
 */
export function useTerminalTabs(
  host: HostClient | null,
  folders: string[],
  tabs: Pick<ReturnType<typeof useTabs>, "close" | "closeEverywhere"> & {
    /** Every conversation's tabs. */
    files: string[];
  },
) {
  const { files, close, closeEverywhere } = tabs;
  const [running, setRunning] = useState<Record<string, string[]>>({});
  // null once a push said nothing runs; pushes are newer than any listing in flight.
  const [commands, setCommands] = useState<Record<string, string | null>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [exits, setExits] = useState(0);
  // Each terminal's folder, as last listed: only a folder that's read again can say one is gone.
  const homes = useRef<Record<string, string>>({});
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
    const failed = new Set<string>();
    const shown = terminalsIn(files);
    void Promise.all(
      (key ? key.split("\n") : []).map(async (cwd) => {
        const list = await host
          .request({ type: "terminal_list", cwd })
          .catch((): TerminalInfo[] => (failed.add(cwd), []));
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
      const read = listed.filter(([cwd]) => !failed.has(cwd));
      for (const id of goneTabs(files, read, homes.current))
        closeEverywhere(id);
      for (const [cwd, list] of read)
        for (const t of list) homes.current[t.terminal] = cwd;
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
  }, [host, key, files, exits, closeEverywhere]);

  const stop = useCallback(
    (terminal: string) => {
      for (const id of files)
        if (terminalOf(id) === terminal) closeEverywhere(id);
      setRunning((all) => without(all, terminal));
      host?.request({ type: "terminal_close", terminal }).catch(() => {});
    },
    [host, files, closeEverywhere],
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
      closeEverywhere(id);
      setRunning((all) => without(all, terminal));
      if (!idle)
        host.request({ type: "terminal_close", terminal }).catch(() => {});
    },
    [host, close, closeEverywhere, commands],
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
