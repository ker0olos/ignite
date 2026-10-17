import type { Item } from "@/components/settings/sections";
import { IconThemePicker } from "@/components/settings/IconThemePicker";
import { ThemePicker } from "@/components/settings/ThemePicker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { CodeTheme } from "@/lib/codeThemes";
import { CUSTOM_THEMES_DIR, listThemes } from "@/lib/codeThemeDiscovery";
import { importTheme } from "@/lib/codeThemeLoad";
import { CUSTOM_ICON_THEMES_DIR, type IconThemeInfo } from "@/lib/iconThemes";
import type { Layout, Settings } from "@/lib/settings";

const LAYOUTS: { value: Layout; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "vscode", label: "VS Code" },
  { value: "jetbrains", label: "JetBrains" },
];

/** Settings rows for appearance: the layout, the theme and icon theme pickers, and the composer's git status. */
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
      title: "Layout",
      description:
        "Arrange the window like VS Code (an activity bar) or a JetBrains IDE (tool windows).",
      keywords:
        "layout mode ide vs code vscode jetbrains intellij activity bar",
      control: (
        <Select
          items={LAYOUTS}
          value={settings.layout}
          onValueChange={(value) =>
            value && onChange({ ...settings, layout: value as Layout })
          }
        >
          <SelectTrigger size="sm" className="w-44 text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {LAYOUTS.map((layout) => (
              <SelectItem
                key={layout.value}
                value={layout.value}
                className="text-[13px]"
              >
                {layout.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
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
      title: "Git status",
      description:
        "Each repository the conversation changed, with uncommitted files, unpushed commits or an open pull request: in the composer, or the VS Code and JetBrains layouts' status bar.",
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
