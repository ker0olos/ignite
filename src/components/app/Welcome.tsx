import { FolderOpen } from "lucide-react";
import { Kbd } from "@/components/agent/Kbd";
import { RecentRow } from "@/components/app/RecentRow";
import { APP_TITLE } from "@/lib/app";

const MAX_RECENT = 8;

/** Shown when a window has no folder open. */
export function Welcome({
  folders,
  home,
  onOpenFolder,
  onSelectFolder,
}: {
  folders: string[];
  home: string;
  onOpenFolder: () => void;
  onSelectFolder: (path: string) => void;
}) {
  return (
    <main className="flex flex-1 items-center justify-center pb-26">
      <div className="w-80">
        <svg
          viewBox="0 0 64 64"
          role="img"
          aria-label={APP_TITLE}
          className="mx-auto mb-10 size-28 fill-muted-foreground stroke-muted-foreground opacity-30"
          strokeWidth="1.5"
          strokeLinejoin="round"
        >
          <path d="M33 26h10L27 56l6-23z" className="opacity-50" />
          <path d="M37 8 23 33h10v-7z" />
        </svg>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Open a folder to start a session, or drop one onto the window.
        </p>
        <button
          onClick={onOpenFolder}
          className="-mx-2 mt-5 flex h-8 w-[calc(100%+1rem)] items-center gap-2 rounded-md px-2 text-[13px] hover:bg-accent"
        >
          <FolderOpen className="size-4 text-muted-foreground" />
          Open Folder
          <Kbd className="ml-auto">⌘O</Kbd>
        </button>
        {folders.length > 0 && (
          <>
            <h2 className="mt-6 mb-1 text-xs font-medium text-muted-foreground">
              Recent
            </h2>
            {folders.slice(0, MAX_RECENT).map((path) => (
              <RecentRow
                key={path}
                path={path}
                home={home}
                onSelect={() => onSelectFolder(path)}
                className="-mx-2 w-[calc(100%+1rem)] hover:bg-accent"
              />
            ))}
          </>
        )}
      </div>
    </main>
  );
}
