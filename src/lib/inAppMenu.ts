import { menuItems } from "./menu";

export type MenuEntry =
  | {
      label: string;
      shortcut?: string;
      enabled?: boolean;
      action?: () => void;
      items?: MenuEntry[];
    }
  | "separator";

type Source = {
  text?: string;
  item?: unknown;
  accelerator?: string;
  enabled?: boolean;
  action?: () => void;
  items?: Source[];
};

function tidy(entries: MenuEntry[]): MenuEntry[] {
  return entries.filter(
    (e, i) =>
      e !== "separator" ||
      (i > 0 && i < entries.length - 1 && entries[i - 1] !== "separator"),
  );
}

function convert(items: Source[]): MenuEntry[] {
  const entries: MenuEntry[] = [];
  for (const s of items) {
    if (s.item === "Separator") entries.push("separator");
    else if (s.text === undefined) continue;
    else if (s.items) {
      const sub = tidy(convert(s.items));
      if (sub.length) entries.push({ label: s.text, items: sub });
    } else {
      entries.push({
        label: s.text,
        shortcut: s.accelerator?.replace("CmdOrCtrl", "Ctrl"),
        enabled: s.enabled,
        action: s.action,
      });
    }
  }
  return tidy(entries);
}

/** The menu bar's items as a tree for the in-app menu; predefined items are left out. */
export function inAppMenuEntries(
  items: ReturnType<typeof menuItems>,
): MenuEntry[] {
  return convert(items as Source[]);
}

/** Whether a key press is the accelerator (`CmdOrCtrl+Shift+W`, `F11`), with exactly its modifiers. */
export function matchesAccelerator(e: KeyboardEvent, accelerator: string) {
  const parts = accelerator.split("+");
  const key = parts.pop() ?? "";
  const has = (m: string) => parts.includes(m);
  return (
    e.ctrlKey === (has("CmdOrCtrl") || has("Ctrl")) &&
    e.shiftKey === has("Shift") &&
    e.altKey === has("Alt") &&
    !e.metaKey &&
    e.key.toLowerCase() === key.toLowerCase()
  );
}

/** The first enabled entry (submenus included) whose shortcut the key press is. */
export function entryForKey(
  entries: MenuEntry[],
  e: KeyboardEvent,
): (() => void) | undefined {
  for (const entry of entries) {
    if (entry === "separator" || entry.enabled === false) continue;
    if (entry.items) {
      const found = entryForKey(entry.items, e);
      if (found) return found;
    } else if (
      entry.action &&
      entry.shortcut &&
      matchesAccelerator(e, entry.shortcut)
    )
      return entry.action;
  }
}
