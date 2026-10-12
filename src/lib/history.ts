const MAX = 100;
const KEY = "composer-history";

/** Every folder's sent messages, oldest first; none when storage is unavailable. */
export function loadHistory(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(saved)
      ? saved.filter((s) => typeof s === "string")
      : [];
  } catch {
    return [];
  }
}

/** Adds a sent message, skipping blanks and a repeat of the last, keeping the newest 100. */
export function saveHistory(text: string) {
  if (!text.trim()) return;
  const entries = loadHistory();
  if (entries.at(-1) === text) return;
  try {
    localStorage.setItem(KEY, JSON.stringify([...entries, text].slice(-MAX)));
  } catch {
    // History is a convenience; without storage there's none.
  }
}

/** Browsing history: a snapshot of it, the shown entry, and the text typed before. */
export type Browse = { entries: string[]; index: number; draft: string };

/**
 * What ↑ (step -1) or ↓ (1) at `caret` shows, or null when the key is the
 * caret's. It recalls only from the text's start or end, unless the shown
 * entry is unedited; past the newest is the draft again.
 */
export function historyStep(
  text: string,
  caret: number,
  step: number,
  browse: Browse | null,
): { browse: Browse | null; text: string } | null {
  const current =
    browse && browse.entries[browse.index] === text ? browse : null;
  if (!current && caret !== (step < 0 ? 0 : text.length)) return null;
  const { entries, index: from, draft } = current ?? start(text);
  const index = from + step;
  if (index < 0 || index > entries.length) return null;
  return index === entries.length
    ? { browse: null, text: draft }
    : { browse: { entries, index, draft }, text: entries[index] };
}

function start(draft: string): Browse {
  const entries = loadHistory();
  return { entries, index: entries.length, draft };
}
