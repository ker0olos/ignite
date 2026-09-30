import type { Item } from "@/components/settings/sections";
import { Kbd } from "@/components/ui/kbd";
import { isWindows } from "@/lib/window";

const MOD = isWindows() ? "Ctrl" : "⌘";

const shortcut = (key: string) => (
  <>
    <Kbd className="h-4">{MOD}</Kbd> <Kbd className="h-4">{key}</Kbd>
  </>
);

/** Reference rows for app-wide keyboard shortcuts. */
export function hotkeysItems(): Item[] {
  return [
    {
      section: "Keyboard Shortcuts",
      title: "Open file search",
      description: "Search files in the current project, then open one.",
      hint: shortcut("P"),
      keywords:
        "hotkeys shortcuts keybindings command p file palette quick open",
    },
    {
      section: "Keyboard Shortcuts",
      title: "Open command center",
      description:
        "Search conversations, files and folders across open projects.",
      hint: shortcut("K"),
      keywords: "hotkeys shortcuts keybindings command k palette",
    },
  ];
}
