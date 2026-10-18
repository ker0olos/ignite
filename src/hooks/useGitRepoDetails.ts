import { useCallback, useEffect, useState } from "react";
import type { GitRepoDetails, GitRepoStatus } from "../../shared/git";
import { confirmNative } from "@/lib/lifecycle";
import { basename } from "@/lib/paths";
import type { HostClient } from "@/lib/piHost";

/** A repository's uncommitted files and unpushed commits, read while `open` and again whenever its status changes; discarding a file's changes. */
export function useGitRepoDetails(
  host: HostClient | null,
  status: GitRepoStatus,
  open: boolean,
) {
  const [details, setDetails] = useState<GitRepoDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [discarded, setDiscarded] = useState(0);
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
  }, [host, open, repo, changed, unpushed, branch, discarded]);

  const discard = useCallback(
    async (path: string) => {
      const ok = await confirmNative(
        `Are you sure you want to discard changes in '${basename(path)}'?`,
        "Discard File",
      );
      if (!ok || !host) return;
      try {
        await host.request({ type: "git_discard", repo, path });
        setDetails(
          (d) => d && { ...d, files: d.files.filter((f) => f.path !== path) },
        );
        setDiscarded((n) => n + 1);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [host, repo],
  );

  return { details, error, discard };
}
