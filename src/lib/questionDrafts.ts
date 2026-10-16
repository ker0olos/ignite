import type { Draft } from "./questions";

/** An ask_user call's answers so far: the question shown and each one's draft. */
export type Deck = { step: number; drafts: Draft[] };

// One key per call, so windows answering different calls don't overwrite each other.
const PREFIX = "question-draft:";
const SAVE_MS = 300;
// Drafts of calls answered or stopped elsewhere are never answered here.
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const pending = new Map<string, Deck | null>();
let timer: ReturnType<typeof setTimeout> | undefined;

/** A call's saved draft, so a reload shows a half-answered question as the user left it. */
export function loadDeck(id: string): Deck | undefined {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFIX + id) ?? "null") as {
      deck?: Deck;
    } | null;
    return saved?.deck;
  } catch {
    return undefined;
  }
}

/** Saves a call's draft (null forgets it) shortly after, so typing doesn't write on every key. */
export function saveDeck(id: string, deck: Deck | null) {
  pending.set(id, deck);
  clearTimeout(timer);
  timer = setTimeout(flushDecks, SAVE_MS);
}

function write(id: string, deck: Deck | null) {
  try {
    if (!deck) localStorage.removeItem(PREFIX + id);
    else
      localStorage.setItem(
        PREFIX + id,
        JSON.stringify({ at: Date.now(), deck }),
      );
  } catch {
    // Too big (images) or no storage: the draft lasts until a reload.
  }
}

function prune() {
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith(PREFIX)) continue;
    try {
      const { at } = JSON.parse(localStorage.getItem(key) ?? "{}") as {
        at?: number;
      };
      if (!at || Date.now() - at > MAX_AGE_MS) localStorage.removeItem(key);
    } catch {
      localStorage.removeItem(key);
    }
  }
}

/** Writes the drafts waiting to be saved now, and forgets week-old ones. */
export function flushDecks() {
  clearTimeout(timer);
  pending.forEach((deck, id) => write(id, deck));
  pending.clear();
  try {
    prune();
  } catch {
    // No storage.
  }
}
