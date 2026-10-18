import { useEffect, useRef, useState } from "react";
import type { GitRepoStatus } from "../../shared/git";
import { cacheGitStatus, cachedGitStatus } from "@/lib/gitStatusCache";
import type { HostClient } from "@/lib/piHost";

const POLL_MS = 5000;
// A conversation just shown is still opening; its repositories are known soon.
const OPENING_MS = 1000;
// Past this many "not open yet" answers, it may never open: back to the usual pace.
const OPENING_TRIES = 10;

/**
 * The repositories the shown conversation worked in: its last known ones at once (from any
 * launch), read again in the background, then 5 seconds after each answer.
 */
export function useGitStatus(
  host: HostClient | null,
  session: string | null,
): GitRepoStatus[] {
  const [found, setFound] = useState<{
    session: string;
    repos: GitRepoStatus[];
  } | null>(null);
  const [reads, setReads] = useState(0);
  const opening = useRef({ session, tries: 0 });

  useEffect(() => {
    if (!host || !session) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let wait = POLL_MS;
    host
      .request({ type: "git_status", session })
      .then((repos) => {
        // Not open yet: the last known ones stay until it is.
        if (opening.current.session !== session)
          opening.current = { session, tries: 0 };
        if (!repos) {
          if (opening.current.tries++ < OPENING_TRIES) wait = OPENING_MS;
          return;
        }
        opening.current.tries = 0;
        cacheGitStatus(session, repos);
        if (!cancelled) setFound({ session, repos });
      })
      // Keeps the last answer; the next read tries again.
      .catch(() => {})
      .finally(() => {
        if (!cancelled) timer = setTimeout(() => setReads((n) => n + 1), wait);
      });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [host, session, reads]);

  if (session && found?.session === session) return found.repos;
  return (session && cachedGitStatus(session)) || [];
}
