import { AppMenuButton } from "@/components/app/AppMenuButton";
import { SettingsButton } from "@/components/app/SettingsButton";
import type { MenuEntry } from "@/lib/windowsMenu";

/** The title strip's buttons: the in-app menu (Windows only, else no entries) and Settings. */
export function TitleButtons({
  menu,
  onSettings,
}: {
  menu: MenuEntry[];
  onSettings: () => void;
}) {
  return (
    <>
      {menu.length > 0 && <AppMenuButton entries={menu} />}
      <SettingsButton onClick={onSettings} />
    </>
  );
}
