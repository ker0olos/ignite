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
      description: "Search files in the open folders, then open one.",
      hint: shortcut("P"),
      keywords:
        "hotkeys shortcuts keybindings command p file palette quick open",
    },
    {
      section: "Keyboard Shortcuts",
      title: "Open command center",
      description: "Search the open folders, their conversations and files.",
      hint: shortcut("K"),
      keywords: "hotkeys shortcuts keybindings command k palette",
    },
    {
      section: "Keyboard Shortcuts",
      title: "Open terminal",
      description: "Open a terminal tab in the current folder.",
      hint: shortcut("1"),
      keywords: "hotkeys shortcuts keybindings command 1 terminal shell",
    },
    {
      section: "Keyboard Shortcuts",
      title: "Open whiteboard",
      description:
        "Draw on a blank page, then add it to the conversation. In Tasks, starts a new task instead.",
      hint: shortcut("N"),
      keywords:
        "hotkeys shortcuts keybindings command n whiteboard draw sketch",
    },
  ];
}
