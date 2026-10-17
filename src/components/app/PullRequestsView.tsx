import type { GitRepoStatus } from "../../../shared/git";
import { PullRequestRepo } from "@/components/app/PullRequestRepo";
import type { HostClient } from "@/lib/piHost";

/** The shown conversation's repositories with their branch, unfinished work and pull request. */
export function PullRequestsView({
  host,
  repos,
  gitStatus,
}: {
  host: HostClient | null;
  repos: GitRepoStatus[];
  /** Off (Settings → Appearance), nothing was read. */
  gitStatus: boolean;
}) {
  if (repos.length === 0) {
    return (
      <p className="px-2 py-1 text-[13px] text-muted-foreground">
        {gitStatus
          ? "This conversation hasn't changed a repository yet."
          : "Git status is off in Settings → Appearance."}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {repos.map((status) => (
        <PullRequestRepo key={status.repo} host={host} status={status} />
      ))}
    </div>
  );
}
