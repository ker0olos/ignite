import type { MemoryObservation } from "../../../shared/hostProtocol";
import { CircleDot } from "lucide-react";
import { OBSERVATION_ICONS } from "@/components/memory/observationIcons";
import { platformName, timeAgo } from "@/lib/memory";

/** One remembered observation: its kind, title, summary, and when and where. */
export function ObservationRow({
  observation,
}: {
  observation: MemoryObservation;
}) {
  // Other modes' kinds get a dot.
  const Icon = OBSERVATION_ICONS[observation.type] ?? CircleDot;
  return (
    <li className="flex gap-3 px-4 py-2.5">
      <Icon
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        aria-label={observation.type.replace("_", " ")}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px]">{observation.title}</p>
        {observation.subtitle && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {observation.subtitle}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right text-xs text-muted-foreground">
        <p>{timeAgo(observation.createdAt)}</p>
        <p className="opacity-70">{platformName(observation.platform)}</p>
      </div>
    </li>
  );
}
