import { GitBranch } from "lucide-react";
import type { GitRepoStatus } from "../../../shared/git";
import { GitRepoStatusItem } from "@/components/agent/GitRepoStatusItem";
import { MENU_TRIGGER } from "@/components/agent/styles";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useElementSize } from "@/hooks/useElementSize";
import { unfinished } from "@/lib/gitStatus";
import type { HostClient } from "@/lib/piHost";
import { cn } from "@/lib/utils";

/**
 * The conversation's repositories with work not yet committed, pushed or merged, after the approval menu;
 * behind a git icon when the row has no room for them.
 */
export function GitStatusLinks({
  host,
  repos,
}: {
  host: HostClient | null;
  repos: GitRepoStatus[];
}) {
  const [box, space] = useElementSize();
  const [row, needed] = useElementSize();
  const shown = unfinished(repos);
  if (shown.length === 0) return null;
  const folded = needed.width > space.width;
  const items = shown.map((status) => (
    <GitRepoStatusItem key={status.repo} host={host} status={status} />
  ));
  return (
    <div ref={box} className="relative flex min-w-0 flex-1 items-center">
      {/* Always laid out at full width, so it can unfold once there's room. */}
      <div
        ref={row}
        aria-hidden={folded}
        className={cn(
          "flex w-max items-center gap-3.5",
          folded && "invisible absolute",
        )}
      >
        {items}
      </div>
      {folded && (
        <Popover>
          <PopoverTrigger
            className={cn(
              MENU_TRIGGER,
              "shrink-0 gap-1 data-[popup-open]:text-foreground",
            )}
            title="Repositories"
          >
            <GitBranch className="size-3.5" aria-hidden="true" />
            {shown.length > 1 && shown.length}
          </PopoverTrigger>
          <PopoverContent
            align="start"
            side="top"
            className="w-auto gap-0.5 px-3 py-1.5"
          >
            {items}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
