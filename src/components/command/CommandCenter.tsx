import { useEffect, useState } from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import type { SessionDetails } from "../../../shared/conversations";
import type { AgentStatus } from "../../../shared/hostProtocol";
import { Kbd } from "@/components/agent/Kbd";
import { CommandPreview } from "@/components/command/CommandPreview";
import { CommandResults } from "@/components/command/CommandResults";
import { Command, CommandEmpty, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useCommandSearch } from "@/hooks/useCommandSearch";
import { useDetailsCache } from "@/hooks/useDetailsCache";
import { usePreviewPick } from "@/hooks/useSettled";
import type { CodeThemes } from "@/lib/codeThemes";
import {
  completed,
  firstPick,
  pickOf,
  type CommandPick,
} from "@/lib/commandQuery";
import type { HostClient } from "@/lib/piHost";
import type { Settings } from "@/lib/settings";

/** What picking a result does. */
export type CommandActions = {
  onConversation: (folder: string, id: string) => void;
  onFile: (folder: string, path: string) => void;
  onFolder: (folder: string) => void;
};

/**
 * ⌘K's command center: one search over every folder's conversations and
 * files and the folders themselves, the highlighted result shown beside the
 * list. `@name` and `#kind` narrow it.
 */
export function CommandCenter({
  open,
  onOpenChange,
  initialQuery,
  host,
  folders,
  home,
  rows,
  details,
  themes,
  editor,
  actions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuery: string;
  host: HostClient | null;
  folders: string[];
  home: string;
  rows: (cwd: string) => AgentStatus[];
  details: (cwd: string, session: string) => Promise<SessionDetails | null>;
  themes: CodeThemes;
  editor: Settings["editor"];
  actions: CommandActions;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [value, setValue] = useState("");
  const found = useCommandSearch(host, query, folders);
  const first = firstPick(found);
  const pick = pickOf(value, found) ?? first;
  const shown = usePreviewPick(pick);
  const { known, want } = useDetailsCache(details);
  const wanted = pick?.kind === "conversation" ? pick : null;
  const wantedFolder = wanted?.folder;
  const wantedId = wanted?.id;

  useEffect(() => {
    if (wantedFolder && wantedId) want(wantedFolder, wantedId);
  }, [wantedFolder, wantedId, want]);

  const choose = (chosen: string) => {
    const p: CommandPick | null = pickOf(chosen, found);
    if (!p) return;
    if (p.kind === "suggestion") return setQuery(completed(query, p.token));
    onOpenChange(false);
    if (p.kind === "conversation") actions.onConversation(p.folder, p.id);
    else if (p.kind === "file") actions.onFile(p.folder, p.path);
    else actions.onFolder(p.folder);
  };

  const nothing = !found.loading && !first;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[12%] w-[min(960px,94vw)] max-w-none translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">Command center</DialogTitle>
        <Command
          shouldFilter={false}
          value={value}
          onValueChange={setValue}
          className="rounded-none! bg-transparent p-0"
        >
          <div className="flex items-center gap-3 border-b px-5">
            <Search className="size-5 shrink-0 text-muted-foreground" />
            <CommandPrimitive.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search conversations, files and folders"
              className="h-14 flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground"
            />
            <span className="shrink-0 text-xs text-muted-foreground">
              @folder · #convos #files #folders
            </span>
          </div>
          <div className="flex h-[min(480px,64vh)]">
            <CommandList className="max-h-none w-1/2 shrink-0 border-r p-2">
              {nothing && (
                <CommandEmpty className="py-8 text-muted-foreground">
                  Nothing matches.
                </CommandEmpty>
              )}
              <CommandResults
                {...found}
                home={home}
                query={found.text}
                onChoose={choose}
              />
            </CommandList>
            <div className="min-w-0 flex-1 overflow-y-auto p-5">
              <CommandPreview
                pick={shown}
                conversations={found.conversations}
                details={known}
                rows={rows}
                home={home}
                themes={themes}
                editor={editor}
                query={found.text}
              />
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
            <Kbd>⌘K</Kbd> or <Kbd>esc</Kbd> to close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
