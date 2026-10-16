import { AppMenuButton } from "@/components/app/AppMenuButton";
import { SettingsButton } from "@/components/app/SettingsButton";
import type { MenuEntry } from "@/lib/inAppMenu";

/** The title strip's buttons: the in-app menu (no entries on macOS) and Settings. */
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
