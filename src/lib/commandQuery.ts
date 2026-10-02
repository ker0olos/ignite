import { basename } from "@/lib/paths";

/** What the command center finds. */
export type ResultKind = "conversation" | "file" | "folder";

/** The kind filters, as typed and as shown; they win over a folder of the same name. */
export const KIND_FILTERS: {
  token: string;
  kind: ResultKind;
  label: string;
}[] = [
  { token: "@conversations", kind: "conversation", label: "Conversations" },
  { token: "@files", kind: "file", label: "Files" },
  { token: "@folders", kind: "folder", label: "Folders" },
];

export type ParsedQuery = {
  /** What's left to search for. */
  text: string;
  /** The folder an `@name` names, when it names one. */
  folder: string | null;
  /** The kinds an `@files`-style filter keeps; null keeps every kind. */
  kinds: ResultKind[] | null;
  /** An `@` token still being typed, to suggest completions for. */
  typing: { partial: string } | null;
};

const byName = (folders: string[], name: string) => {
  const n = name.toLowerCase();
  return (
    folders.find((f) => basename(f).toLowerCase() === n) ??
    folders.filter((f) => basename(f).toLowerCase().startsWith(n)).at(0) ??
    null
  );
};

const typingOf = (last: string | undefined): ParsedQuery["typing"] =>
  last?.startsWith("@") ? { partial: last.slice(1).toLowerCase() } : null;

const kindOf = (token: string) =>
  KIND_FILTERS.find((f) => f.token === token.toLowerCase());

/**
 * Reads the command center's query: `@conversations` / `@files` / `@folders` filter
 * by kind, any other `@name` by folder (its name, or the first starting with
 * it), the rest is searched for.
 */
export function parseQuery(input: string, folders: string[]): ParsedQuery {
  const tokens = input.split(/\s+/).filter(Boolean);
  const last = input.endsWith(" ") ? undefined : tokens.at(-1);
  const typing = typingOf(last);
  const isFolder = (t: string) =>
    t.startsWith("@") && t.length > 1 && !kindOf(t);
  const kinds = new Set<ResultKind>();
  const words: string[] = [];
  for (const token of tokens) {
    const filter = kindOf(token);
    if (filter) kinds.add(filter.kind);
    else if (!isFolder(token) && !(token === last && typing)) words.push(token);
  }
  const named = tokens
    .filter(isFolder)
    .map((t) => byName(folders, t.slice(1)))
    .filter(Boolean);
  return {
    text: words.join(" "),
    folder: named.at(-1) ?? null,
    kinds: kinds.size ? [...kinds] : null,
    typing,
  };
}

/** The query with its last token completed, ready for the next word. */
export const completed = (input: string, token: string) =>
  `${input.replace(/\S*$/, "")}${token} `;

/** Something the command center offers, as picking it acts on it. */
export type CommandPick =
  | { kind: "suggestion"; token: string }
  | { kind: "conversation"; folder: string; id: string }
  | { kind: "file"; folder: string; path: string }
  | { kind: "folder"; folder: string };

/** What the command center found, as its results list shows it. */
export type CommandResultsFound = {
  suggestions: { token: string }[];
  conversations: { folder: string; id: string }[];
  files: { folder: string; path: string }[];
  folders: string[];
};

/** The first thing found, the list's default highlight; null when nothing was. */
export const firstPick = (found: CommandResultsFound) =>
  ["s0", "c0", "f0", "d0"].map((v) => pickOf(v, found)).find(Boolean) ?? null;

/** What a results item's value (kind letter and place: `c3`) stands for, if it's still there. */
export function pickOf(
  value: string,
  found: CommandResultsFound,
): CommandPick | null {
  const i = Number(value.slice(1));
  switch (value[0]) {
    case "s": {
      const s = found.suggestions[i];
      return s ? { kind: "suggestion", token: s.token } : null;
    }
    case "c": {
      const c = found.conversations[i];
      return c ? { kind: "conversation", folder: c.folder, id: c.id } : null;
    }
    case "f": {
      const f = found.files[i];
      return f ? { kind: "file", folder: f.folder, path: f.path } : null;
    }
    case "d": {
      const d = found.folders[i];
      return d ? { kind: "folder", folder: d } : null;
    }
    default:
      return null;
  }
}
