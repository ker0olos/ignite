import { useEffect, useState } from "react";
import { Command as CommandPrimitive } from "cmdk";
import { MessageSquare, Search } from "lucide-react";
import type {
  SavedSession,
  SessionDetails,
} from "../../../shared/conversations";
import { Kbd } from "@/components/agent/Kbd";
import { ConversationDetails } from "@/components/sidebar/ConversationDetails";
import {
  Command,
  CommandEmpty,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { timeAgo } from "@/lib/memory";

/**
 * Spotlight-style search over a folder's closed conversations, the
 * highlighted one's details beside the list; picking one reopens it.
 */
export function ConversationPicker({
  open,
  onOpenChange,
  folderName,
  saved,
  details,
  onHighlight,
  onShow,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderName: string;
  /** Null while they load. */
  saved: SavedSession[] | null;
  /** Details known so far, by conversation (null: couldn't be read). */
  details: Record<string, SessionDetails | null>;
  /** A conversation got highlighted, so its details are wanted. */
  onHighlight: (session: string) => void;
  onShow: (session: string) => void;
}) {
  const [value, setValue] = useState("");
  const selected = saved?.find((s) => s.id === value) ?? saved?.[0];
  const id = selected?.id;

  useEffect(() => {
    if (id) onHighlight(id);
  }, [id, onHighlight]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[14%] w-[min(900px,94vw)] max-w-none translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">
          Previous conversations in {folderName}
        </DialogTitle>
        <Command
          value={value}
          onValueChange={setValue}
          className="rounded-none! bg-transparent p-0"
        >
          <div className="flex items-center gap-3 border-b px-5">
            <Search className="size-5 shrink-0 text-muted-foreground" />
            <CommandPrimitive.Input
              autoFocus
              placeholder={`Search conversations in ${folderName}`}
              className="h-14 flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex h-[min(440px,62vh)]">
            <CommandList className="max-h-none w-1/2 shrink-0 border-r p-2">
              {saved === null ? (
                <div className="py-8 text-center text-muted-foreground">
                  Loading…
                </div>
              ) : (
                <CommandEmpty className="py-8 text-muted-foreground">
                  {saved.length
                    ? "No conversations match."
                    : `No previous conversations in ${folderName}.`}
                </CommandEmpty>
              )}
              {saved?.map((s) => (
                <CommandItem
                  key={s.id}
                  value={s.id}
                  keywords={[s.title]}
                  onSelect={() => onShow(s.id)}
                  className="gap-3 rounded-lg px-3 py-2.5 text-[14px]"
                >
                  <MessageSquare className="text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{s.title}</span>
                  {/* A shortcut slot, so the item leaves out its unused checkmark. */}
                  <CommandShortcut className="shrink-0 text-[13px] tracking-normal">
                    {timeAgo(s.modified)}
                  </CommandShortcut>
                </CommandItem>
              ))}
            </CommandList>
            <div className="min-w-0 flex-1 overflow-y-auto p-5">
              {selected && (
                <ConversationDetails
                  saved={selected}
                  details={details[selected.id]}
                />
              )}
            </div>
          </div>
        </Command>
        <div className="flex justify-end gap-4 border-t px-4 py-2 text-xs text-muted-foreground">
          <span>
            <Kbd>↑↓</Kbd> to move
          </span>
          <span>
            <Kbd>↵</Kbd> to open
          </span>
          <span>
            <Kbd>esc</Kbd> to close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
