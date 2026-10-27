/** grep patterns that span lines (`a\nb`): ripgrep refuses `\n` unless multiline, which pi's grep never turns on. */
import { readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ImageContent, TextContent } from "@earendil-works/pi-ai";

type Result = { content: (TextContent | ImageContent)[] };

const MAX_LINE = 500;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** `pattern` as one pattern per line when it spans lines; undefined for one line, or when a part isn't a pattern alone (a `\n` inside a group). */
export function lineParts(
  pattern: string,
  literal: boolean,
): string[] | undefined {
  const parts = pattern.split(literal ? "\n" : /(?<!\\)\\n|\n/);
  while (parts.length > 1 && parts.at(-1) === "") parts.pop();
  if (parts.length < 2 || !parts[0]) return undefined;
  if (literal) return parts;
  try {
    for (const p of parts) new RegExp(p);
  } catch {
    return undefined;
  }
  return parts;
}

/** Searches for the first part, then keeps the matches whose next lines match the rest, in pi's `path:line: text` form. */
export async function spanningLines<R extends Result>(
  parts: string[],
  input: { path?: string; ignoreCase?: boolean; literal?: boolean },
  search: (pattern: string) => Promise<R>,
  cwd: string,
): Promise<R> {
  const found = await search(parts[0]!);
  const root = resolve(cwd, input.path ?? ".");
  const inFolder = (await stat(root)).isDirectory();
  const rest = parts
    .slice(1)
    .map(
      (p) =>
        new RegExp(input.literal ? escape(p) : p, input.ignoreCase ? "i" : ""),
    );
  const files = new Map<string, Promise<string[]>>();
  const linesOf = (file: string) => {
    if (!files.has(file)) {
      const path = inFolder ? join(root, file) : root;
      files.set(
        file,
        readFile(path, "utf8").then(
          (t) => t.split(/\r?\n/),
          () => [],
        ),
      );
    }
    return files.get(file)!;
  };
  const first = found.content[0];
  const text = first?.type === "text" ? first.text : "";
  const matches: string[] = [];
  for (const [, file = "", n] of text.matchAll(/^(.+?):(\d+): /gm)) {
    const at = Number(n) - 1;
    const lines = await linesOf(file);
    if (!rest.every((re, i) => re.test(lines[at + 1 + i] ?? ""))) continue;
    const shown = lines
      .slice(at, at + parts.length)
      .map(
        (l, i) =>
          `${file}${i ? "-" : ":"}${at + 1 + i}: ${l.slice(0, MAX_LINE)}`,
      );
    matches.push(shown.join("\n"));
  }
  return {
    ...found,
    content: [
      { type: "text", text: matches.join("\n--\n") || "No matches found" },
    ],
  };
}
