import { useEffect, useState } from "react";
import type { ProjectStatus } from "../../shared/hostProtocol";
import type { HostClient } from "@/lib/piHost";

/**
 * What each project open in this window is doing, as the sidecar reports it.
 * Keeps the sidecar in step with `projects`: one closed here ends its session.
 */
export function useProjects(host: HostClient | null, projects: string[]) {
  const [pushed, setPushed] = useState<{
    host: HostClient;
    statuses: ProjectStatus[];
  } | null>(null);
  const statuses = pushed?.host === host ? pushed.statuses : [];
  const closed = statuses
    .map((s) => s.cwd)
    .filter((cwd) => !projects.includes(cwd));
  const closedKey = JSON.stringify(closed);

  useEffect(() => {
    if (!host) return;
    return host.subscribe((message) => {
      if (message.type === "projects") {
        setPushed({ host, statuses: message.projects });
      }
    });
  }, [host]);

  useEffect(() => {
    for (const cwd of JSON.parse(closedKey) as string[]) {
      // A failed shutdown leaves nothing the user can act on.
      host?.request({ type: "close_session", cwd }).catch(() => {});
    }
  }, [host, closedKey]);

  return Object.fromEntries(statuses.map((s) => [s.cwd, s]));
}
