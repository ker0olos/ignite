import type { SessionDetails } from "../../../shared/conversations";
import { Highlight } from "@/components/command/Highlight";
import { DetailsSection } from "@/components/command/DetailsSection";

/** A saved conversation's story: cmem's summary (else its last reply) and the files it edited. */
export function ConversationSummary({
  details,
  query,
}: {
  details: SessionDetails;
  query: string;
}) {
  const { summary, lastReply, files } = details;
  const parts: [string, string | undefined, string][] = [
    ["Last done", summary?.completed, "line-clamp-5"],
    ["Next", summary?.nextSteps, "line-clamp-4"],
    ["Learned", summary?.learned, "line-clamp-4"],
    // Without cmem's account, the agent's own last word.
    [
      "Last reply",
      summary?.completed ? undefined : lastReply,
      "line-clamp-6 whitespace-pre-line",
    ],
  ];
  return (
    <>
      {parts.map(
        ([title, text, className]) =>
          text && (
            <DetailsSection key={title} title={title}>
              <p className={className}>
                <Highlight text={text} query={query} />
              </p>
            </DetailsSection>
          ),
      )}
      {files.length > 0 && (
        <DetailsSection title="Files edited">
          <ul className="flex flex-col gap-0.5 font-mono text-xs text-muted-foreground">
            {files.map((f) => (
              <li key={f} className="truncate">
                <Highlight text={f} query={query} />
              </li>
            ))}
          </ul>
        </DetailsSection>
      )}
    </>
  );
}
