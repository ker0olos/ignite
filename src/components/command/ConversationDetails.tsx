import type {
  ConversationHit,
  SessionDetails,
} from "../../../shared/conversations";
import { DetailsSection } from "@/components/command/DetailsSection";
import { Highlight } from "@/components/command/Highlight";
import { ConversationSummary } from "@/components/command/ConversationSummary";
import { Skeleton } from "@/components/ui/skeleton";
import { detailsLine } from "@/lib/conversations";
import { timeAgo } from "@/lib/memory";

/** The highlighted saved conversation: its title and facts, then its story once loaded. */
export function ConversationDetails({
  saved,
  details,
  query,
}: {
  saved: Pick<
    ConversationHit,
    "title" | "modified" | "messageCount" | "snippet"
  >;
  /** Undefined while it loads; null when it couldn't. */
  details: SessionDetails | null | undefined;
  /** What was searched for, marked where it matched. */
  query: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4 text-[13px]">
      <header className="flex flex-col gap-1">
        <p className="line-clamp-3 text-[14px] font-medium">
          <Highlight text={saved.title} query={query} fuzzy />
        </p>
        <p className="text-xs text-muted-foreground">
          {timeAgo(saved.modified)}
          {details && ` · ${detailsLine(saved, details)}`}
        </p>
      </header>
      {saved.snippet && (
        <DetailsSection title="Matched">
          <p className="line-clamp-4">
            <Highlight text={saved.snippet} query={query} />
          </p>
        </DetailsSection>
      )}
      {details === undefined ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-3/5" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ) : (
        details && <ConversationSummary details={details} query={query} />
      )}
    </div>
  );
}
