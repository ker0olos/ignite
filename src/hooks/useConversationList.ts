import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgentStatus } from "../../shared/hostProtocol";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { HostClient } from "@/lib/piHost";
import { DEMO_FOLDER } from "@/lib/demo";
import { rowsOf, withRunning, without, type Listed } from "@/lib/conversations";
import { store } from "@/lib/store";

// Like the shown folder, only the first window's list outlives the app.
const REMEMBER = getCurrentWindow().label === "main" && !DEMO_FOLDER;

const asAgents = (listed: Listed): AgentStatus[] =>
  Object.entries(listed).flatMap(([cwd, rows]) =>
    rows.map((r) => ({ cwd, ...r, running: false, waiting: false })),
  );

/**
 * The conversations listed under each folder: each one the user started or
 * reopened, until they close it, whether it's running or not (it starts
 * again when shown). With `remember`, the list outlives the app.
 */
export function useConversationList(
  host: HostClient | null,
  remember = REMEMBER,
) {
  const [pushed, setPushed] = useState<{
    host: HostClient;
    agents: AgentStatus[];
  } | null>(null);
  const agents = useMemo(
    () => (pushed?.host === host ? pushed.agents : []),
    [pushed, host],
  );
  const [listed, setListed] = useState<Listed>({});
  // The sidecar may still report one it hasn't closed yet; it stays off the list.
  const closing = useRef(new Set<string>());

  const [loaded, setLoaded] = useState(!remember);

  useEffect(() => {
    if (!remember) return;
    void store.then(async (s) => {
      const saved = (await s.get<Listed>("conversations")) ?? {};
      // Conversations listed while it loaded stay, after the saved ones.
      setListed((meanwhile) => withRunning(saved, asAgents(meanwhile)));
      setLoaded(true);
    });
  }, [remember]);

  useEffect(() => {
    if (!host) return;
    return host.subscribe((message) => {
      if (message.type !== "agents") return;
      const running = new Set(message.agents.map((a) => a.session));
      for (const id of closing.current) {
        if (!running.has(id)) closing.current.delete(id);
      }
      setPushed({ host, agents: message.agents });
      const kept = message.agents.filter(
        (a) => !closing.current.has(a.session),
      );
      setListed((l) => withRunning(l, kept));
    });
  }, [host]);

  useEffect(() => {
    if (remember && loaded)
      void store.then((s) => s.set("conversations", listed));
  }, [remember, loaded, listed]);

  const forget = useCallback((cwd: string, session: string) => {
    closing.current.add(session);
    setListed((l) => without(l, cwd, session));
  }, []);

  return {
    /** The folder's listed conversations, in order, with what each is doing. */
    rows: (cwd: string) => rowsOf(listed, agents, cwd),
    /** Takes a closed conversation off its folder's list. */
    forget,
  };
}
