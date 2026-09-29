import { Folder, Hash, MessageSquare } from "lucide-react";
import type { ConversationHit, FileHit } from "../../../shared/conversations";
import {
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@/components/ui/command";
import { FileResult } from "@/components/command/FileResult";
import { Highlight } from "@/components/command/Highlight";
import { timeAgo } from "@/lib/memory";
import { basename, dirname, tildify } from "@/lib/paths";

const ITEM = "gap-3 rounded-lg px-3 py-2 text-[14px]";

/** The command center's results, grouped by kind; each item's value is its kind and place (see pickOf). */
export function CommandResults({
  suggestions,
  conversations,
  files,
  folders,
  home,
  query,
  onChoose,
}: {
  suggestions: { token: string; label: string }[];
  conversations: ConversationHit[];
  files: FileHit[];
  folders: string[];
  home: string;
  /** What was searched for, marked where it matched. */
  query: string;
  /** An item was picked (Enter or a click), by its value. */
  onChoose: (value: string) => void;
}) {
  return (
    <>
      {suggestions.length > 0 && (
        <CommandGroup heading="Filters">
          {suggestions.map((s, i) => (
            <CommandItem
              key={s.token}
              value={`s${i}`}
              onSelect={onChoose}
              className={ITEM}
            >
              <Hash className="text-muted-foreground" />
              <span>{s.token}</span>
              <CommandShortcut className="truncate text-[13px] tracking-normal">
                {s.token.startsWith("@") ? tildify(s.label, home) : s.label}
              </CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      {conversations.length > 0 && (
        <CommandGroup heading="Conversations">
          {conversations.map((c, i) => (
            <CommandItem
              key={`${c.folder}\0${c.id}`}
              value={`c${i}`}
              onSelect={onChoose}
              className={ITEM}
            >
              <MessageSquare className="text-muted-foreground" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">
                  <Highlight text={c.title} query={query} fuzzy />
                </span>
                {c.snippet && (
                  <span className="truncate text-xs text-muted-foreground">
                    <Highlight text={c.snippet} query={query} />
                  </span>
                )}
              </span>
              <CommandShortcut className="shrink-0 text-[13px] tracking-normal">
                {basename(c.folder)} · {timeAgo(c.modified)}
              </CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      {files.length > 0 && (
        <CommandGroup heading="Files">
          {files.map((f, i) => (
            <CommandItem
              key={`${f.folder}\0${f.path}`}
              value={`f${i}`}
              onSelect={onChoose}
              className={ITEM}
            >
              <FileResult folder={f.folder} path={f.path} query={query} />
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      {folders.length > 0 && (
        <CommandGroup heading="Folders">
          {folders.map((f, i) => (
            <CommandItem
              key={f}
              value={`d${i}`}
              onSelect={onChoose}
              className={ITEM}
            >
              <Folder className="text-muted-foreground" />
              <span className="shrink-0">
                <Highlight text={basename(f)} query={query} fuzzy />
              </span>
              <CommandShortcut className="min-w-0 truncate text-[13px] tracking-normal">
                {tildify(dirname(f), home)}
              </CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
    </>
  );
}
