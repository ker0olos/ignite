import { OBSERVATION_ICONS } from "@/components/memory/observationIcons";
import { FilterChips } from "@/components/settings/FilterChips";
import { kindFilters } from "@/lib/memory";

/** The type filters above the memories: All, then each type the folder has. */
export function KindFilters({
  counts,
  kind,
  onChange,
}: {
  counts: Record<string, number>;
  kind: string | null;
  onChange: (kind: string | null) => void;
}) {
  return (
    <FilterChips
      chips={kindFilters(counts).map(({ kind: id, ...f }) => ({
        ...f,
        id,
        icon: id ? OBSERVATION_ICONS[id] : undefined,
      }))}
      filter={kind}
      onChange={onChange}
    />
  );
}
