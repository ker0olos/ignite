import { useEffect, useState } from "react";
import type { GitRepoStatus } from "../../shared/git";
import type { HostClient } from "@/lib/piHost";

const POLL_MS = 5000;

// Each conversation's last answer, shown at once when it's shown again while a new one is read.
const lastKnown = new Map<string, GitRepoStatus[]>();

/** The repositories the shown conversation worked in, read again 5 seconds after each answer; its last answer until then. */
export function useGitStatus(
  host: HostClient | null,
  session: string | null,
): GitRepoStatus[] {
  const [found, setFound] = useState({ session, repos: [] as GitRepoStatus[] });
  const [reads, setReads] = useState(0);

  useEffect(() => {
    if (!host || !session) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    host
      .request({ type: "git_status", session })
      .then((repos) => {
        lastKnown.set(session, repos ?? []);
        if (!cancelled) setFound({ session, repos: repos ?? [] });
      })
      // Keeps the last answer; the next read tries again.
      .catch(() => {})
      .finally(() => {
        if (!cancelled)
          timer = setTimeout(() => setReads((n) => n + 1), POLL_MS);
      });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [host, session, reads]);

  if (found.session === session) return found.repos;
  return (session && lastKnown.get(session)) || [];
}
