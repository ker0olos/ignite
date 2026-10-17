import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { AppMenuButton } from "@/components/app/AppMenuButton";
import { FolderSwitcher } from "@/components/app/FolderSwitcher";
import { SettingsButton } from "@/components/app/SettingsButton";
import { Button } from "@/components/ui/button";
import { shortcut } from "@/lib/approvalKeys";
import type { IdeChrome } from "@/components/app/IdeWorkspace";
import type { ProjectListProps } from "@/components/sidebar/FolderList";
import { cn } from "@/lib/utils";

/**
 * The IDE layouts' top bar beside the traffic lights (on Windows and Linux,
 * the app menu): VS Code's search box, or JetBrains' folder switcher and buttons.
 */
export function IdeTopBar({
  jetbrains,
  folder,
  projectList,
  chrome,
}: {
  jetbrains: boolean;
  folder: string;
  projectList: ProjectListProps;
  chrome: IdeChrome;
}) {
  const { menu, onSearch, onSettings } = chrome;
  // JetBrains' menu bar unfolds over its folder switcher, as PyCharm's does over the project's.
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header
      data-slot="ide-top-bar"
      data-tauri-drag-region
      className={cn(
        "flex h-13 shrink-0 items-center gap-1 pr-2",
        !jetbrains && "border-b bg-sidebar text-sidebar-foreground",
      )}
    >
      {/* Room for the traffic lights; Windows has none. */}
      <div
        data-tauri-drag-region
        className="h-full w-22 shrink-0 in-[.windows]:w-2"
      />
      {menu.length > 0 && (
        <AppMenuButton entries={menu} onUnfold={setMenuOpen} />
      )}
      {jetbrains && !menuOpen && (
        <FolderSwitcher
          folder={folder}
          folders={projectList.folders}
          onSelect={chrome.onSelectFolder}
          onOpenFolder={projectList.onOpenFolder}
        />
      )}
      <div data-tauri-drag-region className="flex flex-1 justify-center">
        {!jetbrains && (
          <button
            type="button"
            onClick={onSearch}
            className="flex h-6 w-full max-w-md items-center gap-2 rounded-md border bg-muted px-2.5 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Search className="size-3.5" aria-hidden="true" />
            <span className="flex-1 truncate text-left">
              Search conversations, files and folders
            </span>
            <kbd className="font-sans">{shortcut("K")}</kbd>
          </button>
        )}
      </div>
      {jetbrains && (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => projectList.conversations.create(folder)}
          >
            <Plus />
            New conversation
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onSearch}
            aria-label="Search"
            title={`Search (${shortcut("K")})`}
          >
            <Search />
          </Button>
          <SettingsButton onClick={onSettings} />
        </>
      )}
    </header>
  );
}
