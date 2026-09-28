import { Folder } from "lucide-react";
import { basename, dirname, tildify } from "@/lib/paths";
import { cn } from "@/lib/utils";

/** One recently opened folder, in the Welcome screen or the sidebar's project list. */
export function RecentRow({
  path,
  home,
  onSelect,
  className,
}: {
  path: string;
  home: string;
  onSelect: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex h-8 w-full items-center gap-2 rounded-md px-2 text-[13px] hover:bg-sidebar-accent/50",
        className,
      )}
    >
      <Folder className="size-4 shrink-0 text-muted-foreground" />
      <span className="shrink-0">{basename(path)}</span>
      <span className="truncate text-muted-foreground">
        {tildify(dirname(path), home)}
      </span>
    </button>
  );
}
