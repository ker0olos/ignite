import type { ReactNode } from "react";
import { Welcome } from "@/components/app/Welcome";

/** Shown when a window has no folder open: the title bar and Welcome. */
export function WelcomeScreen({
  settingsButton,
  folders,
  home,
  onOpenFolder,
  onSelectFolder,
}: {
  settingsButton: ReactNode;
  folders: string[];
  home: string;
  onOpenFolder: () => void;
  onSelectFolder: (path: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div
        data-tauri-drag-region
        className="flex h-13 shrink-0 items-center justify-end px-2"
      >
        {settingsButton}
      </div>
      <Welcome
        folders={folders}
        home={home}
        onOpenFolder={onOpenFolder}
        onSelectFolder={onSelectFolder}
      />
    </div>
  );
}
