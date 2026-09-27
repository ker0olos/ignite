import type { Item } from "@/components/settings/sections";
import { Switch } from "@/components/ui/switch";
import type { Settings } from "@/lib/settings";

/** Settings rows for the file tree. */
export function filesItems({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
}): Item[] {
  return [
    {
      section: "Files",
      title: "Hide Git-ignored files",
      description: "Leave out files matched by .gitignore.",
      keywords: "gitignore file tree hidden",
      control: (
        <Switch
          checked={settings.files.hide_gitignored}
          onCheckedChange={(hide_gitignored) =>
            onChange({
              ...settings,
              files: { ...settings.files, hide_gitignored },
            })
          }
        />
      ),
    },
  ];
}
