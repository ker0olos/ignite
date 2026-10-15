import { Folder } from "lucide-react";
import type { ConversationHit } from "../../../shared/conversations";
import { Highlight } from "@/components/command/Highlight";
import {
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@/components/ui/command";
import { timeAgo } from "@/lib/memory";
import { basename, dirname, tildify } from "@/lib/paths";

/** One folder's found conversations under its name; each item's value is `c` and its place among all found. */
export function ConversationGroup({
  folder,
  items,
  home,
  query,
  onChoose,
}: {
  folder: string;
  items: { hit: ConversationHit; index: number }[];
  home: string;
  query: string;
  onChoose: (value: string) => void;
}) {
  return (
    <CommandGroup
      heading={
        <span className="flex items-center gap-2">
          <Folder className="size-3.5" />
          <span className="font-semibold text-foreground">
            {basename(folder)}
          </span>
          <span className="min-w-0 truncate">
            {tildify(dirname(folder), home)}
          </span>
          <span className="ml-auto tabular-nums">{items.length}</span>
        </span>
      }
    >
      {items.map(({ hit, index }) => (
        <CommandItem
          key={hit.id}
          value={`c${index}`}
          onSelect={onChoose}
          className="gap-3 rounded-lg py-2 pr-3 pl-[30px] text-[14px]"
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate">
              <Highlight text={hit.title} query={query} fuzzy />
            </span>
            {hit.snippet && (
              <span className="truncate text-xs text-muted-foreground">
                <Highlight text={hit.snippet} query={query} />
              </span>
            )}
          </span>
          <CommandShortcut className="shrink-0 text-xs tracking-normal">
            {timeAgo(hit.modified)}
          </CommandShortcut>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}
