import type { SessionState } from "../../shared/hostProtocol";

const KEY = "session-state";
const MAX = 200;
// What a new conversation starts with.
const DRAFT = "";

type Choice = Pick<SessionState, "model" | "thinkingLevel" | "thinkingLevels">;
/** The newest state's models and skills, and each conversation's model and effort. */
type Saved = { last?: SessionState; choices: Record<string, Choice> };

function load(): Saved {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Saved;
    return saved?.choices ? saved : { choices: {} };
  } catch {
    return { choices: {} };
  }
}

let cache: Saved | null = null;
// One object per conversation until the next save, since renders read it.
let shown = new Map<string, SessionState>();

/**
 * The conversation's last known model and effort (null: a new one's), from
 * any earlier launch too; null when never seen. Skills are left out: the
 * newest state may be another folder's.
 */
export function cachedState(session: string | null): SessionState | null {
  const key = session ?? DRAFT;
  cache ??= load();
  const choice = cache.choices[key];
  if (!cache.last || !choice) return null;
  if (!shown.has(key)) shown.set(key, { ...cache.last, ...choice, skills: [] });
  return shown.get(key) ?? null;
}

/** Remembers the conversation's state, keeping the newest 200 conversations' model and effort. */
export function cacheState(session: string | null, state: SessionState) {
  const { model, thinkingLevel, thinkingLevels } = state;
  const key = session ?? DRAFT;
  cache ??= load();
  const same =
    JSON.stringify(cache.last) === JSON.stringify(state) &&
    JSON.stringify(cache.choices[key]) ===
      JSON.stringify({ model, thinkingLevel, thinkingLevels });
  if (same) return;
  shown = new Map();
  // Other windows save theirs too.
  const choices = Object.entries(load().choices)
    .filter(([s]) => s !== key)
    .slice(-(MAX - 1));
  cache = {
    last: state,
    choices: {
      ...Object.fromEntries(choices),
      [key]: { model, thinkingLevel, thinkingLevels },
    },
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Only a head start; without storage it's in memory until a reload.
  }
}
