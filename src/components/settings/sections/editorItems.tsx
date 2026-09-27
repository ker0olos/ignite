import type { Item } from "@/components/settings/sections";
import { FontInput } from "@/components/settings/FontInput";
import { Switch } from "@/components/ui/switch";
import type { Settings } from "@/lib/settings";

/** Settings rows for the file viewer: font and word wrap. */
export function editorItems({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
}): Item[] {
  return [
    {
      section: "Editor",
      title: "Font",
      description: "Comma-separated; the first installed one is used.",
      keywords: "font family typeface monospace",
      control: (
        <FontInput
          value={settings.editor.font_family}
          onCommit={(font_family) =>
            onChange({
              ...settings,
              editor: { ...settings.editor, font_family },
            })
          }
        />
      ),
    },
    {
      section: "Editor",
      title: "Word wrap",
      description: "Wrap long lines to the viewer's width.",
      keywords: "line",
      control: (
        <Switch
          checked={settings.editor.word_wrap}
          onCheckedChange={(word_wrap) =>
            onChange({ ...settings, editor: { ...settings.editor, word_wrap } })
          }
        />
      ),
    },
  ];
}
