import type {
  ConversationHit,
  SessionDetails,
} from "../../../shared/conversations";
import { DetailsSection } from "@/components/command/DetailsSection";
import { Highlight } from "@/components/command/Highlight";
import { RecentMessageRow } from "@/components/command/RecentMessageRow";
import { SubtaskPeek } from "@/components/command/SubtaskPeek";
import { Skeleton } from "@/components/ui/skeleton";
import { counted } from "@/lib/conversations";
import { timeAgo } from "@/lib/memory";
import { basename } from "@/lib/paths";

/** The highlighted saved conversation: its title, its subtasks and its latest messages once loaded. */
export function ConversationDetails({
  saved,
  details,
  query,
}: {
  saved: Pick<
    ConversationHit,
    "folder" | "title" | "modified" | "messageCount" | "snippet"
  >;
  /** Undefined while it loads; null when it couldn't. */
  details: SessionDetails | null | undefined;
  /** What was searched for, marked where it matched. */
  query: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4 text-[14px]">
      <header className="flex flex-col gap-0.5">
        <p className="line-clamp-2 text-base font-semibold">
          <Highlight text={saved.title} query={query} fuzzy />
        </p>
        <p className="text-xs text-muted-foreground">
          {basename(saved.folder)} · {timeAgo(saved.modified)} ·{" "}
          {counted(saved.messageCount, "message")}
        </p>
      </header>
      {details && details.subtasks.length > 0 && (
        <SubtaskPeek subtasks={details.subtasks} />
      )}
      {saved.snippet && (
        <DetailsSection title="Matched">
          <p className="line-clamp-3 text-[13px]">
            <Highlight text={saved.snippet} query={query} />
          </p>
        </DetailsSection>
      )}
      {details === undefined ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-3/5 self-end rounded-2xl" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ) : (
        details && (
          <div className="flex flex-col gap-3.5 border-t pt-4">
            {details.recent.map((m, i) => (
              <RecentMessageRow key={i} message={m} query={query} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
