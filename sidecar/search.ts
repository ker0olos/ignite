import type {
  CommandSearch,
  CommandSearchResult,
  ConversationHit,
  FileHit,
} from "../shared/conversations.ts";
import { basename } from "node:path";
import { fuzzyScore } from "../shared/fuzzy.ts";
import type { SessionStore } from "./hostTypes.ts";

type Indexed = Awaited<ReturnType<SessionStore["list"]>>[number];
type Scored<T> = { hit: T; score: number };

// Little before the match, so it isn't cut off where the results row truncates.
const BEFORE = 20;
const AFTER = 100;

// A title matches loosely; the whole text only as typed, lest every long
// conversation match everything.
function scoreConversation(
  folder: string,
  { text, ...s }: Indexed,
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
  indexes: [string, Indexed[]][],
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
  const name = fuzzyScore(query, basename(path));
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

function cached<T>(load: (folder: string) => Promise<T>, ttl: number) {
  const kept = new Map<string, { at: number; value: Promise<T> }>();
  return (folder: string) => {
    const hit = kept.get(folder);
    if (hit && Date.now() - hit.at < ttl) return hit.value;
    const value = load(folder).catch((error: unknown) => {
      kept.delete(folder);
      throw error;
    });
    kept.set(folder, { at: Date.now(), value });
    return value;
  };
}

/**
 * The command center's search over folders' conversations and files, each
 * folder's lists kept a short while so typing doesn't reread them.
 */
export function createSearch(
  sessions: Pick<SessionStore, "list">,
  files: (folder: string) => Promise<string[]>,
) {
  const conversationsOf = cached(sessions.list, 15_000);
  const filesOf = cached(files, 60_000);
  const each = async <T>(
    folders: string[],
    load: (folder: string) => Promise<T[]>,
  ) =>
    Promise.all(
      folders.map(
        async (f) => [f, await load(f).catch(() => [])] as [string, T[]],
      ),
    );

  return async (request: CommandSearch): Promise<CommandSearchResult> => {
    const { text, folders, kinds, limit } = request;
    const [conversations, fileLists] = await Promise.all([
      kinds.includes("conversation") ? each(folders, conversationsOf) : [],
      kinds.includes("file") && text ? each(folders, filesOf) : [],
    ]);
    return {
      conversations: rankConversations(conversations, text, limit),
      files: rankFiles(fileLists, text, limit),
    };
  };
}
