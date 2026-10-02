import { useEffect, useState } from "react";
import type { GitRepoDetails, GitRepoStatus } from "../../shared/git";
import type { HostClient } from "@/lib/piHost";

/** A repository's uncommitted files and unpushed commits, read while `open` and again whenever its status changes. */
export function useGitRepoDetails(
  host: HostClient | null,
  status: GitRepoStatus,
  open: boolean,
) {
  const [details, setDetails] = useState<GitRepoDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { repo, changed, unpushed, branch } = status;

  useEffect(() => {
    if (!host || !open) return;
    let cancelled = false;
    host
      .request({ type: "git_repo_details", repo })
      .then((next) => {
        if (cancelled) return;
        setDetails(next ?? { files: [], commits: [] });
        setError(null);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [host, open, repo, changed, unpushed, branch]);

  return { details, error };
}
