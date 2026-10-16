import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import type { MenuEntry } from "@/lib/windowsMenu";

/** Renders menu entries, submenus included, as dropdown items. */
export function AppMenuItems({ entries }: { entries: MenuEntry[] }) {
  return entries.map((entry, i) => {
    if (entry === "separator") return <DropdownMenuSeparator key={i} />;
    if (entry.items)
      return (
        <DropdownMenuSub key={entry.label}>
          <DropdownMenuSubTrigger>{entry.label}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <AppMenuItems entries={entry.items} />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      );
    return (
      <DropdownMenuItem
        key={entry.label}
        disabled={entry.enabled === false}
        onClick={() => entry.action?.()}
      >
        {entry.label}
        {entry.shortcut && (
          <DropdownMenuShortcut>{entry.shortcut}</DropdownMenuShortcut>
        )}
      </DropdownMenuItem>
    );
  });
}
