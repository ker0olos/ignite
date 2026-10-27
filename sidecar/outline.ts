/** A code file's definitions (functions, classes, methods…) by line, from tree-sitter's tags queries. */
import { lstat, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Language, Parser, Query, type Node } from "web-tree-sitter";
import { listFiles } from "./fileIndex.ts";

const grammarFile = (name: string) =>
  fileURLToPath(import.meta.resolve(`../shared/grammars/${name}`));
const JS = "javascript-tags.scm";
const TS = "typescript-tags.scm";

const GRAMMARS: Record<string, { wasm: string; tags: string[] }> = {
  typescript: { wasm: "tree-sitter-typescript.wasm", tags: [JS, TS] },
  tsx: { wasm: "tree-sitter-tsx.wasm", tags: [JS, TS] },
  javascript: { wasm: "tree-sitter-javascript.wasm", tags: [JS] },
  python: { wasm: "tree-sitter-python.wasm", tags: ["python-tags.scm"] },
  rust: { wasm: "tree-sitter-rust.wasm", tags: ["rust-tags.scm"] },
  go: { wasm: "tree-sitter-go.wasm", tags: ["go-tags.scm"] },
};

const BY_EXTENSION: Record<string, string> = {
  ".ts": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".tsx": "tsx",
  ".js": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".jsx": "javascript",
  ".py": "python",
  ".rs": "rust",
  ".go": "go",
};

/** Whether `outline` reads files like `path`. */
export const outlines = (path: string) =>
  extname(path).toLowerCase() in BY_EXTENSION;

const loaded = new Map<string, Promise<{ parser: Parser; query: Query }>>();

/** A grammar's parser and tags query, loaded once. */
function grammar(name: string) {
  let found = loaded.get(name);
  if (!found) {
    const { wasm, tags } = GRAMMARS[name];
    found = (async () => {
      await Parser.init();
      const language = await Language.load(grammarFile(wasm));
      const scm = await Promise.all(
        tags.map((t) => readFile(grammarFile(t), "utf8")),
      );
      const parser = new Parser();
      parser.setLanguage(language);
      return { parser, query: new Query(language, scm.join("\n")) };
    })();
    // A failed load is tried again next time, not cached.
    found.catch(() => loaded.delete(name));
    loaded.set(name, found);
  }
  return found;
}

type Def = { node: Node; name?: string };

/** The tagged definitions, each once, in file order. */
function definitions(query: Query, root: Node): Def[] {
  const byId = new Map<number, Def>();
  for (const match of query.matches(root)) {
    const def = match.captures.find((c) => c.name.startsWith("definition."));
    const name = match.captures.find((c) => c.name === "name")?.node.text;
    if (def) byId.set(def.node.id, { node: def.node, name });
  }
  return [...byId.values()].sort(
    (a, b) => a.node.startIndex - b.node.startIndex,
  );
}

const holds = (outer: Node, inner: Node) =>
  outer !== inner &&
  outer.startIndex <= inner.startIndex &&
  outer.endIndex >= inner.endIndex;

/** A code file's definitions, parsed with its grammar. */
async function parsed(path: string) {
  const name = BY_EXTENSION[extname(path).toLowerCase()];
  if (!name) {
    throw new Error(
      `No outline for ${extname(path) || "this kind of"} files; read it instead.`,
    );
  }
  const { parser, query } = await grammar(name);
  const source = await readFile(path, "utf8");
  const tree = parser.parse(source);
  if (!tree) throw new Error(`Couldn't parse ${path}.`);
  return { source, tree, defs: definitions(query, tree.rootNode) };
}

/** `line: signature` for each definition, indented under the ones holding it; only top-level ones with `top`. */
async function entries(path: string, top = false): Promise<string[]> {
  const { source, tree, defs } = await parsed(path);
  const sourceLines = source.split("\n");
  const lines = defs.flatMap(({ node }) => {
    const depth = defs.filter((o) => holds(o.node, node)).length;
    if (top && depth > 0) return [];
    const row = node.startPosition.row;
    const head = sourceLines[row].trim().slice(0, 120);
    return [`${row + 1}: ${"  ".repeat(depth)}${head}`];
  });
  tree.delete();
  return lines;
}

/** A code file's definitions by line, nested ones indented. */
export async function outline(path: string): Promise<string> {
  const lines = await entries(path);
  return lines.join("\n") || "No definitions found; read it instead.";
}

const MAX_FOLDER_FILES = 80;
// About 7,500 tokens, so one call can't flood the context.
const MAX_FOLDER_CHARS = 30_000;

const TEST_FILE =
  /(^|\/)(__tests__|tests?)\/|\.(test|spec)\.[^/]+$|_test\.(go|py|rs)$|(^|\/)test_[^/]+\.py$/;

/** `files` that aren't symlinks, which could lead outside the folder unasked. */
async function plainFiles(folder: string, files: string[]) {
  const links = await Promise.all(
    files.map((f) =>
      lstat(join(folder, f)).then(
        (s) => s.isSymbolicLink(),
        () => true,
      ),
    ),
  );
  return files.filter((_, i) => !links[i]);
}

/** The parts that fit in MAX_FOLDER_CHARS, whole ones only. */
function fitting(parts: string[]) {
  let size = 0;
  const kept = parts.filter((p) => (size += p.length + 1) <= MAX_FOLDER_CHARS);
  return kept.length ? kept : parts.slice(0, 1);
}

/** Each code file under `folder` (as git lists them, tests left out) with its top-level definitions. */
export async function outlineFolder(folder: string): Promise<string> {
  const listed = (await listFiles(folder))
    .filter((f) => outlines(f) && !TEST_FILE.test(f))
    .sort();
  const files = await plainFiles(folder, listed);
  if (!files.length) {
    return "No code files here that outline reads; ls it instead.";
  }
  const parts = await Promise.all(
    files.slice(0, MAX_FOLDER_FILES).map(async (file) => {
      const lines = await entries(join(folder, file), true).catch(
        (e: Error) => [e.message],
      );
      return [file, ...lines.map((l) => `  ${l}`)].join("\n");
    }),
  );
  const shown = fitting(parts);
  const more = files.length - shown.length;
  const note = more
    ? `\n[${more} more code files; outline a folder inside this one.]`
    : "";
  return shown.join("\n") + note;
}

/** A definition by name and 1-based line range. */
export type Definition = { name: string; start: number; end: number };

/** The innermost definition holding each of `lines` (1-based); a line outside every definition has none. */
export async function definitionsAt(
  path: string,
  lines: number[],
): Promise<Map<number, Definition>> {
  const { tree, defs } = await parsed(path);
  const at = new Map<number, Definition>();
  for (const line of lines) {
    // In file order, so the last that holds the line is the innermost.
    const inner = defs.findLast(
      ({ node }) =>
        node.startPosition.row < line && node.endPosition.row >= line - 1,
    );
    if (inner)
      at.set(line, {
        name: inner.name ?? "anonymous",
        start: inner.node.startPosition.row + 1,
        end: inner.node.endPosition.row + 1,
      });
  }
  tree.delete();
  return at;
}

/** The 1-based line ranges of the definitions named `symbol` ("open", or "Box.open" for one inside Box). */
export async function symbolLines(
  path: string,
  symbol: string,
): Promise<{ start: number; end: number }[]> {
  const { tree, defs } = await parsed(path);
  const dot = symbol.lastIndexOf(".");
  const name = symbol.slice(dot + 1);
  const outer = dot < 0 ? undefined : symbol.slice(0, dot).split(".").pop();
  const found = defs
    .filter(
      (d) =>
        d.name === name &&
        (!outer || defs.some((o) => o.name === outer && holds(o.node, d.node))),
    )
    .map(({ node }) => ({
      start: node.startPosition.row + 1,
      end: node.endPosition.row + 1,
    }));
  tree.delete();
  return found;
}
