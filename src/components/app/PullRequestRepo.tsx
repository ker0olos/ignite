import type { GitRepoStatus } from "../../../shared/git";
import { GitRepoDetailsPanel } from "@/components/agent/GitRepoDetailsPanel";
import { useGitRepoDetails } from "@/hooks/useGitRepoDetails";
import type { HostClient } from "@/lib/piHost";

/** One repository in the PR view: what the composer's git status opens, kept open. */
export function PullRequestRepo({
  host,
  status,
}: {
  host: HostClient | null;
  status: GitRepoStatus;
}) {
  const { details, error, discard } = useGitRepoDetails(host, status, true);
  return (
    <div className="rounded-lg border">
      <GitRepoDetailsPanel
        status={status}
        details={details}
        error={error}
        onDiscard={discard}
      />
    </div>
  );
}
