import { terminalOf } from "./childTabs";
import { neighbour } from "./tabs";

const isTerminal = (tab: string | null) => !!tab && terminalOf(tab) !== null;

/**
 * Where the IDE layouts put the editor's tabs: all in one strip, or VS Code's terminals in a panel.
 * `kept` stays in front while the panel's terminal is active; `picked` is the panel's last terminal.
 */
export function ideTabs(
  files: string[],
  active: string | null,
  { kept, picked }: { kept: string | null; picked: string | null },
  panel: boolean,
) {
  const strip = panel ? files.filter((t) => !isTerminal(t)) : files;
  const terminals = panel ? files.filter(isTerminal) : [];
  const shownTab = panel && isTerminal(active) ? kept : active;
  const front = shownTab && strip.includes(shownTab) ? shownTab : null;
  const shown =
    [active, picked].find((t) => t && terminals.includes(t)) ??
    terminals.at(-1) ??
    null;
  return { strip, terminals, front, panel: shown };
}

/** What a tab strip has: its conversations and files, the front tab, the conversation behind. */
type Strip = {
  conversations: string[];
  files: string[];
  front: string | null;
  shown: string | null;
};

/** What comes to the front once a tab closes; `conversation: null` is a new one. */
export type Front = { file: string } | { conversation: string | null };

/**
 * After closing the front `tab`, null for any other: a file gives way to the next
 * file, else the conversation behind it; a conversation to the next conversation, else a file.
 */
export function nextFront(
  { conversations, files, front, shown }: Strip,
  tab: string,
): Front | null {
  if (tab !== front) return null;
  if (files.includes(tab)) {
    const file = neighbour(files, tab);
    if (file) return { file };
    const left = conversations.filter((c) => c !== tab);
    return {
      conversation:
        shown && left.includes(shown) ? shown : (left.at(-1) ?? null),
    };
  }
  const conversation = neighbour(conversations, tab);
  if (conversation) return { conversation };
  return files[0] ? { file: files[0] } : { conversation: null };
}
