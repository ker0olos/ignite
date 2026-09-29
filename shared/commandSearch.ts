import type {
  ConversationHit,
  FileHit,
  SavedSession,
} from "./conversations.ts";
import { fuzzyScore } from "./fuzzy.ts";

/** A saved conversation with all its text, as the command center searches it. */
export type IndexedConversation = SavedSession & { text: string };

type Scored<T> = { hit: T; score: number };

// Little before the match, so it isn't cut off where the results row truncates.
const BEFORE = 20;
const AFTER = 100;

// A title matches loosely; the whole text only as typed, lest every long
// conversation match everything.
function scoreConversation(
  folder: string,
  { text, ...s }: IndexedConversation,
  query: string,
): Scored<ConversationHit> | null {
  if (!query) return { hit: { ...s, folder }, score: s.modified };
  const title = fuzzyScore(query, s.title);
  if (title !== null) return { hit: { ...s, folder }, score: title + 1000 };
  const at = text.toLowerCase().indexOf(query.toLowerCase());
  if (at === -1) return null;
  const from = Math.max(0, at - BEFORE);
  const snippet = text
    .slice(from, at + query.length + AFTER)
    .replace(/\s+/g, " ")
    .trim();
  return {
    hit: { ...s, folder, snippet: `${from > 0 ? "…" : ""}${snippet}…` },
    score: 500 - at / 1000,
  };
}

const best = <T>(scored: (Scored<T> | null)[], limit: number) =>
  scored
    .filter((s): s is Scored<T> => s !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.hit);

/** The conversations of `folders` best matching `query` (the newest, without one). */
export const rankConversations = (
  indexes: [string, IndexedConversation[]][],
  query: string,
  limit: number,
) =>
  best(
    indexes.flatMap(([folder, items]) =>
      items.map((i) => scoreConversation(folder, i, query)),
    ),
    limit,
  );

// A match in the file's own name beats one in the folders around it.
function fileScore(query: string, path: string) {
  const name = fuzzyScore(query, path.slice(path.lastIndexOf("/") + 1));
  return name !== null ? name + 2000 : fuzzyScore(query, path);
}

/** The files of `folders` whose paths best match `query`; none without one. */
export const rankFiles = (
  lists: [string, string[]][],
  query: string,
  limit: number,
): FileHit[] =>
  query
    ? best(
        lists.flatMap(([folder, paths]) =>
          paths.map((path) => {
            const score = fileScore(query, path);
            return score === null ? null : { hit: { folder, path }, score };
          }),
        ),
        limit,
      )
    : [];
