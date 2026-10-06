import type { Item } from "@/components/settings/sections";
import { Switch } from "@/components/ui/switch";
import type { Settings } from "@/lib/settings";

/** Settings rows for the file tree, under Appearance; the rest need the tree shown. */
export function filesItems({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
}): Item[] {
  const setFiles = (files: Partial<Settings["files"]>) =>
    onChange({ ...settings, files: { ...settings.files, ...files } });
  return [
    {
      section: "Appearance",
      title: "Show file tree",
      description:
        "Show the folder's files under its conversations in the sidebar.",
      keywords: "file tree explorer sidebar files hide",
      control: (
        <Switch
          checked={settings.files.show_tree}
          onCheckedChange={(show_tree) => setFiles({ show_tree })}
        />
      ),
    },
    {
      section: "Appearance",
      title: "Resizable sidebar split",
      description: "Drag the divider between conversations and files.",
      keywords: "height divider conversations files file explorer sidebar",
      control: (
        <Switch
          checked={settings.sidebar.resizable_split}
          disabled={!settings.files.show_tree}
          onCheckedChange={(resizable_split) =>
            onChange({
              ...settings,
              sidebar: { ...settings.sidebar, resizable_split },
            })
          }
        />
      ),
    },
    {
      section: "Appearance",
      title: "Hide Git-ignored files",
      description: "Leave out files matched by .gitignore.",
      keywords: "gitignore file tree hidden",
      control: (
        <Switch
          checked={settings.files.hide_gitignored}
          disabled={!settings.files.show_tree}
          onCheckedChange={(hide_gitignored) => setFiles({ hide_gitignored })}
        />
      ),
    },
  ];
}
