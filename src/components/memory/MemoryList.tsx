import { ObservationRow } from "@/components/memory/ObservationRow";
import type { MemoryObservation } from "../../../shared/memory";

function emptyText(folder: boolean, filtered: boolean) {
  if (filtered) return "No memories match.";
  return folder
    ? "Nothing remembered for this folder yet. Memories appear here as the agent works."
    : "Open a folder to see what's remembered about it.";
}

/** The memories as expandable rows, or why there are none. */
export function MemoryList({
  observations,
  hasFolder,
  filtered,
}: {
  observations: MemoryObservation[];
  hasFolder: boolean;
  filtered: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      {observations.length ? (
        <ul className="divide-y">
          {observations.map((o) => (
            <ObservationRow key={o.id} observation={o} />
          ))}
        </ul>
      ) : (
        <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">
          {emptyText(hasFolder, filtered)}
        </p>
      )}
    </div>
  );
}
