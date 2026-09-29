import { Command as CommandPrimitive } from "cmdk";
import { MessageSquare, Search } from "lucide-react";
import type { SavedSession } from "../../../shared/hostProtocol";
import { Kbd } from "@/components/agent/Kbd";
import {
  Command,
  CommandEmpty,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { timeAgo } from "@/lib/memory";

/** Spotlight-style search over a folder's closed conversations; picking one reopens it. */
export function ConversationPicker({
  open,
  onOpenChange,
  folderName,
  saved,
  onShow,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderName: string;
  /** Null while they load. */
  saved: SavedSession[] | null;
  onShow: (session: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[18%] w-[min(640px,90vw)] max-w-none translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">
          Previous conversations in {folderName}
        </DialogTitle>
        <Command className="rounded-none! bg-transparent p-0">
          <div className="flex items-center gap-3 border-b px-5">
            <Search className="size-5 shrink-0 text-muted-foreground" />
            <CommandPrimitive.Input
              autoFocus
              placeholder={`Search conversations in ${folderName}`}
              className="h-14 flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground"
            />
          </div>
          <CommandList className="max-h-[min(420px,60vh)] p-2">
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
                value={`${s.title} ${s.id}`}
                onSelect={() => onShow(s.id)}
                className="gap-3 rounded-lg px-3 py-2.5 text-[14px]"
              >
                <MessageSquare className="text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{s.title}</span>
                <span className="shrink-0 text-[13px] text-muted-foreground">
                  {timeAgo(s.modified)}
                </span>
              </CommandItem>
            ))}
          </CommandList>
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
