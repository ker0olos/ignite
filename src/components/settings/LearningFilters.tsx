import { FilterChips } from "@/components/settings/FilterChips";
import { ListSearch } from "@/components/settings/ListSearch";
import type { Section } from "@/components/settings/sections";
import type { useLessons } from "@/hooks/useLessons";
import type { useProcedures } from "@/hooks/useProcedures";
import type { useReflector } from "@/hooks/useReflector";
import {
  activeFilter,
  lessonChips,
  procedureChips,
  reflectionChips,
  type Chip,
} from "@/lib/learningFilters";

type Hooks = {
  lessons: ReturnType<typeof useLessons>;
  procedures: ReturnType<typeof useProcedures>;
  reflector: ReturnType<typeof useReflector>;
};

type View = {
  noun: string;
  query: string;
  setQuery: (query: string) => void;
  filter: string | null;
  setFilter: (filter: string | null) => void;
  chips: Chip[];
};

function viewOf(section: Section, h: Hooks): View | null {
  switch (section) {
    case "Lessons":
      return {
        noun: "lessons",
        ...h.lessons,
        chips: lessonChips(h.lessons.lessons ?? []),
      };
    case "Procedures":
      return {
        noun: "procedures",
        ...h.procedures,
        chips: procedureChips(h.procedures.procedures ?? []),
      };
    case "Reflector":
      return {
        noun: "points",
        ...h.reflector,
        chips: reflectionChips(h.reflector.reflections ?? []),
      };
    default:
      return null;
  }
}

/** A search box and filter chips above the Lessons, Procedures and Reflector lists. */
export function LearningFilters({
  section,
  ...hooks
}: Hooks & { section: Section }) {
  const view = viewOf(section, hooks);
  if (!view || view.chips[0].count === 0) return null;
  const { noun, chips } = view;
  return (
    <div className="space-y-3">
      <ListSearch
        label={`Search ${noun}`}
        placeholder={`Search ${noun}`}
        query={view.query}
        onChange={view.setQuery}
      />
      <FilterChips
        chips={chips}
        filter={activeFilter(chips, view.filter)}
        onChange={view.setFilter}
      />
    </div>
  );
}
