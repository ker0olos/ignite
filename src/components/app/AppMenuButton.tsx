import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { AppMenuItems } from "@/components/app/AppMenuItems";
import { Button } from "@/components/ui/button";
import {
  Menubar,
  MenubarContent,
  MenubarMenu,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { listedEntries, type MenuEntry } from "@/lib/inAppMenu";

// Moving between menus closes one just before the next opens; the bar waits that out.
const FOLD_MS = 150;

/**
 * The menu bar on Windows and Linux: a button that unfolds into its menus
 * (File, Edit…) with File open, as VS Code's does, and folds once none is.
 */
export function AppMenuButton({ entries }: { entries: MenuEntry[] }) {
  const menus = listedEntries(entries).flatMap((e) =>
    e !== "separator" && e.items ? [{ ...e, items: e.items }] : [],
  );
  const [open, setOpen] = useState<string | null>(null);
  const [unfolded, setUnfolded] = useState(false);
  useEffect(() => {
    if (open !== null || !unfolded) return;
    const fold = setTimeout(() => setUnfolded(false), FOLD_MS);
    return () => clearTimeout(fold);
  }, [open, unfolded]);

  if (!unfolded)
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Menu"
        onClick={() => {
          setUnfolded(true);
          setOpen(menus[0]?.label ?? null);
        }}
      >
        <Menu />
      </Button>
    );
  return (
    <Menubar className="h-7 gap-0 border-0 p-0">
      {menus.map((menu) => (
        <MenubarMenu
          key={menu.label}
          open={open === menu.label}
          onOpenChange={(next) =>
            setOpen((current) =>
              next ? menu.label : current === menu.label ? null : current,
            )
          }
        >
          <MenubarTrigger className="h-6 px-2 text-[13px] font-normal">
            {menu.label}
          </MenubarTrigger>
          <MenubarContent>
            <AppMenuItems entries={menu.items} />
          </MenubarContent>
        </MenubarMenu>
      ))}
    </Menubar>
  );
}
