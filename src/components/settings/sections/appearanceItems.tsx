import type { Item } from "@/components/settings/sections";
import { IconThemePicker } from "@/components/settings/IconThemePicker";
import { ThemePicker } from "@/components/settings/ThemePicker";
import { RailSwitch } from "@/components/settings/RailSwitch";
import type { CodeTheme } from "@/lib/codeThemes";
import { CUSTOM_THEMES_DIR, listThemes } from "@/lib/codeThemeDiscovery";
import { importTheme } from "@/lib/codeThemeLoad";
import { CUSTOM_ICON_THEMES_DIR, type IconThemeInfo } from "@/lib/iconThemes";
import type { Settings } from "@/lib/settings";

/** Settings rows for appearance: the theme and icon theme pickers, and the composer's git status. */
export function appearanceItems({
  themes,
  iconThemes,
  settings,
  onChange,
  onThemesChange,
}: {
  themes: CodeTheme[];
  iconThemes: IconThemeInfo[];
  settings: Settings;
  onChange: (settings: Settings) => void;
  onThemesChange: (themes: CodeTheme[]) => void;
}): Item[] {
  return [
    {
      section: "Appearance",
      title: "Theme",
      description: `Also sets light or dark mode. Add your own to ~/${CUSTOM_THEMES_DIR}.`,
      keywords: "color dark light mode vs code cursor windsurf vscodium",
      control: (
        <ThemePicker
          themes={themes}
          value={settings.theme}
          onChange={async (id) => {
            // Editor themes are copied in, so uninstalling the editor later
            // can't break the saved choice.
            const theme = await importTheme(id);
            onChange({ ...settings, theme });
            if (theme !== id) listThemes(true).then(onThemesChange);
          }}
        />
      ),
    },
    {
      section: "Appearance",
      title: "File icons",
      description: `Icon themes installed in VS Code, Cursor, Windsurf or VSCodium. Add your own to ~/${CUSTOM_ICON_THEMES_DIR}.`,
      keywords: "icon theme pack file folder material seti jetbrains vs code",
      control: (
        <IconThemePicker
          themes={iconThemes}
          value={settings.icon_theme}
          onChange={(icon_theme) => onChange({ ...settings, icon_theme })}
        />
      ),
    },
    {
      section: "Appearance",
      title: "Git status in the composer",
      description:
        "Show each repository the conversation changed with uncommitted files, unpushed commits or an open pull request.",
      keywords: "git branch pull request pr uncommitted unpushed repository",
      control: (
        <RailSwitch
          checked={settings.composer.git_status}
          onCheckedChange={(git_status) =>
            onChange({ ...settings, composer: { git_status } })
          }
        />
      ),
    },
  ];
}
