import { openUrl } from "@tauri-apps/plugin-opener";
import { ArrowUp, ExternalLink, GitBranch, Pencil } from "lucide-react";
import type { GitRepoDetails, GitRepoStatus } from "../../../shared/git";
import { GitChangeRow } from "@/components/conversation/GitChangeRow";
import { GitCommitList } from "@/components/conversation/GitCommitList";
import { prState } from "@/lib/gitStatus";

/** What a repository's pill opens: its branch, uncommitted files (each opening its diff), unpushed commits and pull request. */
export function GitRepoDetailsPanel({
  status,
  details,
  error,
}: {
  status: GitRepoStatus;
  details: GitRepoDetails | null;
  error: string | null;
}) {
  const { pr } = status;
  const files = details?.files ?? [];
  const commits = details?.commits ?? [];
  return (
    <div className="divide-y text-[13px]">
      <div className="space-y-0.5 px-3 py-2.5">
        <p className="font-medium text-foreground">{status.name}</p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <GitBranch className="size-3 shrink-0" />
          <span className="truncate font-mono">
            {status.branch ?? "detached HEAD"}
          </span>
        </p>
      </div>
      {error && <p className="px-3 py-2 text-xs text-destructive">{error}</p>}
      {files.length > 0 && (
        <div className="max-h-64 space-y-1 overflow-y-auto px-1.5 py-2">
          <p className="flex items-center gap-1.5 px-1.5 text-xs text-muted-foreground">
            <Pencil className="size-3" />
            Uncommitted {files.length}
          </p>
          {files.map((file) => (
            <GitChangeRow
              key={file.path}
              repo={status.repo}
              range="HEAD"
              file={file}
            />
          ))}
        </div>
      )}
      {commits.length > 0 && (
        <GitCommitList icon={ArrowUp} label="Not pushed:" commits={commits} />
      )}
      <div className="px-3 py-2 text-xs text-muted-foreground">
        {pr ? (
          <button
            type="button"
            className="flex items-center gap-1.5 outline-none hover:text-foreground focus-visible:text-foreground"
            onClick={() => openUrl(pr.url).catch(() => {})}
          >
            PR #{pr.number} {prState(pr)}
            <ExternalLink className="size-3" />
          </button>
        ) : (
          "No pull request yet"
        )}
      </div>
    </div>
  );
}
