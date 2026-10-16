import { Menu } from "lucide-react";
import { AppMenuItems } from "@/components/app/AppMenuItems";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MenuEntry } from "@/lib/inAppMenu";

/** The menu bar's items as a dropdown, on Windows and Linux; sits beside Settings. */
export function AppMenuButton({ entries }: { entries: MenuEntry[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label="Menu" />}
      >
        <Menu />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <AppMenuItems entries={entries} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
