import { KindFilters } from "@/components/memory/KindFilters";
import { MemoryList } from "@/components/memory/MemoryList";
import { ListSearch } from "@/components/settings/ListSearch";
import type { useMemory } from "@/hooks/useMemory";
import { totalOf } from "@/lib/memory";
import { basename } from "@/lib/paths";

function heading(folder: string | null, searching: boolean) {
  if (!folder) return "Recent memories";
  return `${searching ? "Matches" : "Recent memories"} in ${basename(folder)}`;
}

/** The open folder's memories: a search, type filters and its latest. */
export function MemoryPreview({
  folder,
  memory: { status, query, setQuery, kind, setKind },
}: {
  folder: string | null;
  memory: ReturnType<typeof useMemory>;
}) {
  if (!status) return null;
  const { observations, counts } = status;
  const count = totalOf(counts);
  const searching = query.trim() !== "";
  const filtered = searching || kind !== null;
  return (
    <div className="mt-4 space-y-3">
      {folder && (
        <ListSearch
          label="Search memories"
          placeholder={`Search ${basename(folder)}'s memories`}
          query={query}
          onChange={setQuery}
        />
      )}
      {folder && (count > 0 || filtered) && (
        <KindFilters counts={counts} kind={kind} onChange={setKind} />
      )}
      <div>
        <h3 className="mb-2 flex justify-between text-xs font-medium text-muted-foreground">
          <span>{heading(folder, searching)}</span>
          {folder && count > 0 && <span>{count.toLocaleString()} in all</span>}
        </h3>
        <MemoryList
          observations={observations}
          hasFolder={!!folder}
          filtered={filtered}
        />
      </div>
    </div>
  );
}
