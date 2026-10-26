import type { ComponentType } from "react";
import { FilterPill } from "@/components/settings/FilterPill";

/** A row of filters: All first, then the rest; `filter` null is All. */
export function FilterChips({
  chips,
  filter,
  onChange,
}: {
  chips: {
    id: string | null;
    label: string;
    count: number;
    icon?: ComponentType<{ className?: string }>;
  }[];
  filter: string | null;
  onChange: (filter: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <FilterPill
          key={c.id ?? "all"}
          {...c}
          pressed={c.id === filter}
          onPress={() => onChange(c.id)}
        />
      ))}
    </div>
  );
}
