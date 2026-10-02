import { useEffect, useState } from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import type { SessionDetails } from "../../../shared/conversations";
import type { AgentStatus } from "../../../shared/hostProtocol";
import { CommandFooter } from "@/components/command/CommandFooter";
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
import { cn } from "@/lib/utils";

const WITH_PREVIEW = {
  width: "w-[min(960px,94vw)]",
  height: "h-[min(480px,64vh)]",
  list: "w-1/2 border-r max-sm:w-full max-sm:border-r-0",
};
// Without a preview to fill, the dialog is only as tall as its results.
const NO_PREVIEW = {
  width: "w-[min(720px,94vw)]",
  height: "max-h-[min(480px,64vh)]",
  list: "w-full",
};

/** What picking a result does. */
export type CommandActions = {
  onConversation: (folder: string, id: string) => void;
  onFile: (folder: string, path: string) => void;
  onFolder: (folder: string) => void;
};

/**
 * ⌘K's command center: one search over every folder's conversations and
 * files and the folders themselves, the highlighted result shown beside the
 * list (unless `preview` is off). `@name` and `@files`-style kinds narrow it.
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
  preview,
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
  preview: boolean;
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
  const layout = preview ? WITH_PREVIEW : NO_PREVIEW;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "top-[12%] max-w-none max-sm:top-[4%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-none",
          layout.width,
        )}
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
            <span className="shrink-0 text-xs text-muted-foreground max-sm:hidden">
              @convos @files @folders
            </span>
          </div>
          <div className={cn("flex", layout.height)}>
            <CommandList className={cn("max-h-none shrink-0 p-2", layout.list)}>
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
            {/* On a phone results take the width; tapping one opens it, so no preview. */}
            {preview && (
              <div className="min-w-0 flex-1 overflow-y-auto p-5 max-sm:hidden">
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
            )}
          </div>
        </Command>
        <CommandFooter />
      </DialogContent>
    </Dialog>
  );
}
