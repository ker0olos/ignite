import { createElement } from "react";
import type { GitChange } from "../../../shared/git";
import { RevertButton } from "@/components/conversation/RevertButton";
import { useOpenTab } from "@/hooks/useOpenTab";
import { diffTabId } from "@/lib/diffTabs";
import { fileIcon } from "@/lib/fileIcons";
import { basename, dirname } from "@/lib/paths";
import { cn } from "@/lib/utils";

const STATUS_CLASS: Record<GitChange["status"], string> = {
  M: "text-warning",
  A: "text-success",
  D: "text-destructive",
  T: "text-warning",
  U: "text-muted-foreground",
};

/** One changed file: its icon, name, folder, added/removed counts and status, opening its diff; with `onRevert`, a button discarding its changes. */
export function GitChangeRow({
  repo,
  range,
  file,
  onRevert,
}: {
  repo: string;
  range: string;
  file: GitChange;
  onRevert?: () => void;
}) {
  const openTab = useOpenTab();
  const dir = file.path.includes("/") ? dirname(file.path) : "";
  const binary = file.added === null || file.removed === null;

  return (
    // The whole row opens the diff; its button is what keyboards reach.
    <div
      className="group flex cursor-default items-center gap-2 rounded px-1.5 text-[13px] hover:bg-accent"
      onClick={() =>
        openTab(
          diffTabId({ repo, range, path: file.path, status: file.status }),
        )
      }
    >
      <button
        type="button"
        title={file.path}
        className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left outline-none"
      >
        {createElement(fileIcon(file.path), { className: "size-3.5 shrink-0" })}
        <span className="shrink-0">{basename(file.path)}</span>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {dir}
        </span>
      </button>
      {onRevert && <RevertButton path={file.path} onRevert={onRevert} />}
      <span className="flex shrink-0 items-center gap-1.5 text-xs">
        {binary ? (
          <span className="text-muted-foreground">binary</span>
        ) : (
          <>
            {file.added! > 0 && (
              <span className="text-success">+{file.added}</span>
            )}
            {file.removed! > 0 && (
              <span className="text-destructive">−{file.removed}</span>
            )}
          </>
        )}
      </span>
      <span
        className={cn(
          "w-3 shrink-0 text-center font-mono text-xs",
          STATUS_CLASS[file.status],
        )}
      >
        {file.status}
      </span>
    </div>
  );
}
