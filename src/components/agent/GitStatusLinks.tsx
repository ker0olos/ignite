import type { GitRepoStatus } from "../../../shared/git";
import { GitRepoStatusItem } from "@/components/agent/GitRepoStatusItem";
import { unfinished } from "@/lib/gitStatus";
import type { HostClient } from "@/lib/piHost";

/** The conversation's repositories with work not yet committed, pushed or merged, after the approval menu. */
export function GitStatusLinks({
  host,
  repos,
}: {
  host: HostClient | null;
  repos: GitRepoStatus[];
}) {
  const shown = unfinished(repos);
  if (shown.length === 0) return null;
  return (
    <div className="flex min-w-0 items-center gap-3.5 overflow-hidden">
      {shown.map((status) => (
        <GitRepoStatusItem key={status.repo} host={host} status={status} />
      ))}
    </div>
  );
}
