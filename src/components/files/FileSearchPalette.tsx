import { useState } from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import { FileResult } from "@/components/command/FileResult";
import { Kbd } from "@/components/agent/Kbd";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useFileSearch } from "@/hooks/useFileSearch";
import type { HostClient } from "@/lib/piHost";
import { basename } from "@/lib/paths";

const ITEM = "gap-3 rounded-lg px-3 py-2 text-[14px]";

/** VS Code-style file palette for the current folder, opened with ⌘/Ctrl+P. */
export function FileSearchPalette({
  open,
  onOpenChange,
  host,
  folder,
  onFile,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  host: HostClient | null;
  folder: string | null;
  onFile: (folder: string, path: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [value, setValue] = useState("");
  const { files, loading } = useFileSearch(host, folder, query);

  const choose = (chosen: string) => {
    const i = Number(chosen.slice(1));
    const file = chosen[0] === "f" ? files[i] : null;
    if (!file) return;
    onOpenChange(false);
    onFile(file.folder, file.path);
  };

  const title = folder ? `Open file in ${basename(folder)}` : "Open file";
  const empty = loading ? "Searching…" : "No files match.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[10%] w-[min(720px,92vw)] max-w-none translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <Command
          shouldFilter={false}
          value={value}
          onValueChange={setValue}
          className="rounded-none! bg-transparent p-0"
        >
          <div className="flex items-center gap-3 border-b px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <CommandPrimitive.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder={title}
              className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
            />
          </div>
          <CommandList className="max-h-[min(420px,60vh)] p-2">
            {files.length === 0 && (
              <CommandEmpty className="py-8 text-muted-foreground">
                {empty}
              </CommandEmpty>
            )}
            {files.length > 0 && (
              <CommandGroup heading={basename(folder ?? "Files")}>
                {files.map((f, i) => (
                  <CommandItem
                    key={`${f.folder}\0${f.path}`}
                    value={`f${i}`}
                    onSelect={choose}
                    className={ITEM}
                  >
                    <FileResult folder={f.folder} path={f.path} query={query} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
        <div className="flex justify-end gap-4 border-t px-4 py-2 text-xs text-muted-foreground max-sm:hidden">
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
