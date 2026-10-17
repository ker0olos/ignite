import { ChevronDown, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { basename } from "@/lib/paths";

/** The JetBrains layout's folder switcher: the shown folder, switching to another open one or opening one. */
export function FolderSwitcher({
  folder,
  folders,
  onSelect,
  onOpenFolder,
}: {
  folder: string;
  folders: string[];
  onSelect: (folder: string) => void;
  onOpenFolder: () => void;
}) {
  const name = basename(folder);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" className="gap-2 font-semibold" />
        }
      >
        <span className="flex size-5 items-center justify-center rounded-[5px] bg-sidebar-primary text-[11px] text-sidebar-primary-foreground uppercase">
          {name.slice(0, 1)}
        </span>
        {name}
        <ChevronDown className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {folders.map((path) => (
          <DropdownMenuItem
            key={path}
            onClick={() => onSelect(path)}
            className="text-[13px]"
          >
            {basename(path)}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onOpenFolder} className="text-[13px]">
          <FolderPlus />
          Open folder…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
