import { useEffect, useState } from "react";
import type { AgentStatus, ProjectStatus } from "../../shared/hostProtocol";
import type { HostClient } from "@/lib/piHost";

/** Folds a folder's conversations into one status: working or waiting if any is. */
export function byFolder(agents: AgentStatus[]): Record<string, ProjectStatus> {
  const folders: Record<string, ProjectStatus> = {};
  for (const { cwd, running, waiting } of agents) {
    const f = folders[cwd];
    folders[cwd] = {
      cwd,
      running: running || !!f?.running,
      waiting: waiting || !!f?.waiting,
    };
  }
  return folders;
}

/**
 * What each project open in this window is doing, as the sidecar reports it.
 * Keeps the sidecar in step with `projects`: one closed here ends its sessions.
 */
export function useProjects(host: HostClient | null, projects: string[]) {
  const [pushed, setPushed] = useState<{
    host: HostClient;
    agents: AgentStatus[];
  } | null>(null);
  const statuses = byFolder(pushed?.host === host ? pushed.agents : []);
  const closed = Object.keys(statuses).filter((cwd) => !projects.includes(cwd));
  const closedKey = JSON.stringify(closed);

  useEffect(() => {
    if (!host) return;
    return host.subscribe((message) => {
      if (message.type === "agents") {
        setPushed({ host, agents: message.agents });
      }
    });
  }, [host]);

  useEffect(() => {
    for (const cwd of JSON.parse(closedKey) as string[]) {
      // A failed shutdown leaves nothing the user can act on.
      host?.request({ type: "close_session", cwd }).catch(() => {});
    }
  }, [host, closedKey]);

  return statuses;
}
