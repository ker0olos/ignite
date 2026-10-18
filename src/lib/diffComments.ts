/** A line a comment quotes: its kind and number (new file's, or old file's when removed). */
export type CommentLine = {
  kind: "add" | "del" | "ctx";
  num: number;
  text: string;
};

/** A comment on a range of a diff tab's rows, kept until sent or deleted. */
export type DiffComment = {
  id: number;
  repo: string;
  path: string;
  range: string;
  /** The rows it covers in the diff, `to` the one it shows under. */
  from: number;
  to: number;
  lines: CommentLine[];
  text: string;
};

/** Comments are kept by conversation; null is a folder's new one, not started yet. */
type Key = string | null;

const EMPTY: DiffComment[] = [];
let byConversation = new Map<Key, DiffComment[]>();
let nextId = 1;
const listeners = new Set<() => void>();

function put(key: Key, comments: DiffComment[]) {
  byConversation = new Map(byConversation);
  if (comments.length) byConversation.set(key, comments);
  else byConversation.delete(key);
  listeners.forEach((l) => l());
}

/** The conversation's comments, in the order they were added. */
export function diffComments(key: Key): DiffComment[] {
  return byConversation.get(key) ?? EMPTY;
}

/** Calls `listener` whenever any comment changes; returns the unsubscribe. */
export function subscribeDiffComments(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** Adds a comment to the conversation; returns its id. */
export function addDiffComment(key: Key, comment: Omit<DiffComment, "id">) {
  const id = nextId++;
  put(key, [...diffComments(key), { ...comment, id }]);
  return id;
}

/** Replaces a comment's text. */
export function editDiffComment(key: Key, id: number, text: string) {
  put(
    key,
    diffComments(key).map((c) => (c.id === id ? { ...c, text } : c)),
  );
}

/** Deletes a comment. */
export function removeDiffComment(key: Key, id: number) {
  put(
    key,
    diffComments(key).filter((c) => c.id !== id),
  );
}

/** Deletes the given comments (the ones just sent), keeping any added since. */
export function clearDiffComments(key: Key, sent: DiffComment[]) {
  const ids = new Set(sent.map((c) => c.id));
  put(
    key,
    diffComments(key).filter((c) => !ids.has(c.id)),
  );
}
