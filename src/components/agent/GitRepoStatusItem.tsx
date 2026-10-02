import { createElement, useState } from "react";
import {
  ArrowUp,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
  Pencil,
} from "lucide-react";
import type { GitRepoStatus } from "../../../shared/git";
import { GitRepoDetailsPanel } from "@/components/agent/GitRepoDetailsPanel";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { MENU_TRIGGER } from "@/components/agent/styles";
import { useGitRepoDetails } from "@/hooks/useGitRepoDetails";
import { prState, shortName } from "@/lib/gitStatus";
import type { HostClient } from "@/lib/piHost";
import { cn } from "@/lib/utils";

const PR_ICON = {
  open: GitPullRequest,
  draft: GitPullRequestDraft,
  merged: GitMerge,
  closed: GitPullRequestClosed,
};
const PR_CLASS = {
  open: "text-success",
  draft: "text-muted-foreground",
  merged: "text-muted-foreground",
  closed: "text-destructive",
};
const ICON = "size-3 shrink-0";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** One repository: its name, then icons for uncommitted files, unpushed commits and its pull request; clicked, its details. */
export function GitRepoStatusItem({
  host,
  status,
}: {
  host: HostClient | null;
  status: GitRepoStatus;
}) {
  const [open, setOpen] = useState(false);
  const { details, error } = useGitRepoDetails(host, status, open);
  const { pr } = status;
  const state = pr && prState(pr);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          MENU_TRIGGER,
          "shrink-0 gap-1.5 data-[popup-open]:text-foreground",
        )}
        title={`${status.name} on ${status.branch ?? "a detached HEAD"}`}
      >
        <span>{shortName(status.name)}</span>
        {status.changed > 0 && (
          <span
            className="flex items-center gap-0.5"
            title={plural(status.changed, "uncommitted file")}
          >
            <Pencil className={ICON} aria-hidden="true" />
            {status.changed}
          </span>
        )}
        {status.unpushed > 0 && (
          <span
            className="flex items-center gap-0.5"
            title={`${plural(status.unpushed, "commit")} not pushed`}
          >
            <ArrowUp className={ICON} aria-hidden="true" />
            {status.unpushed}
          </span>
        )}
        {pr && state && (
          <span
            title={`PR #${pr.number} ${state}`}
            className={cn("flex items-center gap-0.5", PR_CLASS[state])}
          >
            {createElement(PR_ICON[state], {
              className: ICON,
              "aria-hidden": true,
            })}
            {pr.number}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-96 gap-0 p-0">
        <GitRepoDetailsPanel status={status} details={details} error={error} />
      </PopoverContent>
    </Popover>
  );
}
