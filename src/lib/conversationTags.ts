/** Tags by conversation (pi session) id; kept after a conversation closes. */
export type ConversationTags = Record<string, string[]>;

/** Trims, drops blanks and duplicates, and sorts case-insensitively. */
export const normalizedTags = (tags: readonly string[]) =>
  Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }),
  );

/** Typed or pasted text split at commas into tags. */
export const splitTags = (text: string) => normalizedTags(text.split(","));

/** The tags with the ones in `text` added. */
export const addTags = (tags: readonly string[], text: string) =>
  normalizedTags([...tags, ...splitTags(text)]);

/** The tags without `tag`. */
export const removeTag = (tags: readonly string[], tag: string) =>
  tags.filter((t) => t !== tag);

/** Other conversations' tags this one lacks, narrowed to those containing the typed text. */
export function suggestionsFor(
  all: readonly string[],
  tags: readonly string[],
  text: string,
) {
  const query = text.trim().toLowerCase();
  return all.filter(
    (tag) => !tags.includes(tag) && tag.toLowerCase().includes(query),
  );
}

/** One conversation's tags saved in the map; none removes its entry. */
export function withTagsFor(
  map: ConversationTags,
  session: string,
  tags: readonly string[],
): ConversationTags {
  const next = normalizedTags(tags);
  const rest = Object.fromEntries(
    Object.entries(map).filter(([id]) => id !== session),
  );
  return next.length ? { ...rest, [session]: next } : rest;
}
