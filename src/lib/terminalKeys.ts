import { isMac, isWindows } from "@/lib/window";

type Mod = "metaKey" | "altKey" | "ctrlKey";

const WORD = { Backspace: "\x17", ArrowLeft: "\x1bb", ArrowRight: "\x1bf" };

// Readline and zsh sequences for what text fields do with these keys (iTerm's "Natural Text Editing" on macOS).
// Windows' PowerShell (PSReadLine) already takes xterm's Ctrl+arrows and Ctrl+Backspace through ConPTY.
const KEYS: Record<
  "mac" | "linux" | "windows",
  Partial<Record<Mod, Record<string, string>>>
> = {
  mac: {
    metaKey: { Backspace: "\x15", ArrowLeft: "\x01", ArrowRight: "\x05" },
    altKey: WORD,
  },
  linux: { ctrlKey: WORD },
  windows: {},
};

const MODS: Mod[] = ["metaKey", "altKey", "ctrlKey"];

/** The bytes an editing key sends to the shell (line start/end, word back/forward, delete line/word), if it is one. */
export function editingKey(
  e: KeyboardEvent,
  platform: keyof typeof KEYS = isMac()
    ? "mac"
    : isWindows()
      ? "windows"
      : "linux",
): string | undefined {
  const held = MODS.filter((m) => e[m]);
  if (e.shiftKey || held.length !== 1) return undefined;
  return KEYS[platform][held[0]]?.[e.key];
}
