import type { MemoryObservation } from "../../../shared/memory";
import { ChevronRight, CircleDot } from "lucide-react";
import { useState } from "react";
import { ObservationDetail } from "@/components/memory/ObservationDetail";
import { OBSERVATION_ICONS } from "@/components/memory/observationIcons";
import { platformName, timeAgo } from "@/lib/memory";
import { cn } from "@/lib/utils";

/** One remembered observation: its kind, title, summary, and when and where; opens to its facts and files. */
export function ObservationRow({
  observation,
}: {
  observation: MemoryObservation;
}) {
  const [open, setOpen] = useState(false);
  // Other modes' kinds get a dot.
  const Icon = OBSERVATION_ICONS[observation.type] ?? CircleDot;
  const expandable =
    observation.facts.length > 0 || observation.files.length > 0;
  const head = (
    <>
      <Icon
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        aria-label={observation.type.replace("_", " ")}
      />
      <span className="block min-w-0 flex-1">
        <span className="block truncate text-[13px]">{observation.title}</span>
        {observation.subtitle && !open && (
          <span className="line-clamp-1 text-xs text-muted-foreground">
            {observation.subtitle}
          </span>
        )}
      </span>
      <span className="block shrink-0 text-right text-xs text-muted-foreground">
        <span className="block">{timeAgo(observation.createdAt)}</span>
        <span className="block opacity-70">
          {platformName(observation.platform)}
        </span>
      </span>
      {expandable && (
        <ChevronRight
          className={cn(
            "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90",
          )}
        />
      )}
    </>
  );
  if (!expandable) return <li className="flex gap-3 px-4 py-2.5">{head}</li>;
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full gap-3 px-4 py-2.5 text-left"
      >
        {head}
      </button>
      {open && (
        <div className="px-4 pb-2.5">
          <ObservationDetail observation={observation} />
        </div>
      )}
    </li>
  );
}
