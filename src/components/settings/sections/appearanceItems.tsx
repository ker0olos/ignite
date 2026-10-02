import type { Item } from "@/components/settings/sections";
import { ThemePicker } from "@/components/settings/ThemePicker";
import { Switch } from "@/components/ui/switch";
import type { CodeTheme } from "@/lib/codeThemes";
import { CUSTOM_THEMES_DIR, listThemes } from "@/lib/codeThemeDiscovery";
import { importTheme } from "@/lib/codeThemeLoad";
import type { Settings } from "@/lib/settings";

/** Settings rows for appearance: the theme picker, and the composer's git status. */
export function appearanceItems({
  themes,
  settings,
  onChange,
  onThemesChange,
}: {
  themes: CodeTheme[];
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
      title: "Git status in the composer",
      description:
        "Show each repository the conversation changed with uncommitted files, unpushed commits or an open pull request.",
      keywords: "git branch pull request pr uncommitted unpushed repository",
      control: (
        <Switch
          checked={settings.composer.git_status}
          onCheckedChange={(git_status) =>
            onChange({ ...settings, composer: { git_status } })
          }
        />
      ),
    },
  ];
}
