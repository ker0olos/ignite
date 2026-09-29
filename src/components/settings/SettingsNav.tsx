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
    <nav className="flex w-52 shrink-0 flex-col gap-0.5 overflow-y-auto border-r bg-sidebar p-2 max-sm:w-full max-sm:overflow-visible max-sm:border-r-0 max-sm:border-b">
      {/* On a phone: search on its own line, clear of the dialog's close button. */}
      <label className="sticky top-0 z-10 mb-2 flex h-7 shrink-0 items-center gap-1.5 max-sm:mr-10 rounded-md border bg-background px-2 text-muted-foreground focus-within:ring-2 focus-within:ring-ring/50">
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
      {/* A column on desktop; on a phone, a strip that scrolls sideways. */}
      <div className="contents max-sm:flex max-sm:gap-1 max-sm:overflow-x-auto">
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
                "flex w-full shrink-0 items-start gap-2 rounded-md px-2 py-1 text-left text-[13px] max-sm:w-auto max-sm:items-center max-sm:py-1.5",
                !q && s === section
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50",
                dim && "opacity-40",
              )}
            >
              <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground max-sm:mt-0" />
              <span className="min-w-0">
                <span className="block">{s}</span>
                <span className="block truncate text-[11px] text-muted-foreground max-sm:hidden">
                  {SECTIONS[s].brief}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
