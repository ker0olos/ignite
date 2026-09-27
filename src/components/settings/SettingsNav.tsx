import type { RefObject } from "react";
import { Search } from "lucide-react";
import {
  SECTION_NAMES,
  SECTIONS,
  type Item,
  type Section,
} from "@/components/settings/sections";
import { cn } from "@/lib/utils";

/** The dialog's left column: a search box and the section buttons. */
export function SettingsNav({
  search,
  query,
  onQueryChange,
  section,
  onSectionChange,
  items,
  matches,
}: {
  search: RefObject<HTMLInputElement | null>;
  query: string;
  onQueryChange: (query: string) => void;
  section: Section;
  onSectionChange: (section: Section) => void;
  items: Item[];
  matches: (item: Item) => boolean;
}) {
  const q = query.trim();
  return (
    <nav className="flex w-52 shrink-0 flex-col gap-0.5 border-r bg-sidebar p-2">
      <label className="mb-2 flex h-7 items-center gap-1.5 rounded-md border bg-background px-2 text-muted-foreground focus-within:ring-2 focus-within:ring-ring/50">
        <Search className="size-3.5 shrink-0" />
        <input
          ref={search}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search"
          spellCheck={false}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
        />
      </label>
      {SECTION_NAMES.map((s) => {
        const Icon = SECTIONS[s].icon;
        const dim = q && !items.some((i) => i.section === s && matches(i));
        return (
          <button
            key={s}
            onClick={() => {
              onQueryChange("");
              onSectionChange(s);
            }}
            className={cn(
              "flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px]",
              !q && s === section
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/50",
              dim && "opacity-40",
            )}
          >
            <Icon className="size-4 text-muted-foreground" />
            {s}
          </button>
        );
      })}
    </nav>
  );
}
