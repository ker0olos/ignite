/** A code file's definitions (functions, classes, methods…) by line, from tree-sitter's tags queries. */
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { extname } from "node:path";
import { Language, Parser, Query, type Node } from "web-tree-sitter";

const require = createRequire(import.meta.url);
const JS = "tree-sitter-javascript/queries/tags.scm";
const TS = "tree-sitter-typescript/queries/tags.scm";

const GRAMMARS: Record<string, { wasm: string; tags: string[] }> = {
  typescript: {
    wasm: "tree-sitter-typescript/tree-sitter-typescript.wasm",
    tags: [JS, TS],
  },
  tsx: { wasm: "tree-sitter-typescript/tree-sitter-tsx.wasm", tags: [JS, TS] },
  javascript: {
    wasm: "tree-sitter-javascript/tree-sitter-javascript.wasm",
    tags: [JS],
  },
  python: {
    wasm: "tree-sitter-python/tree-sitter-python.wasm",
    tags: ["tree-sitter-python/queries/tags.scm"],
  },
  rust: {
    wasm: "tree-sitter-rust/tree-sitter-rust.wasm",
    tags: ["tree-sitter-rust/queries/tags.scm"],
  },
  go: {
    wasm: "tree-sitter-go/tree-sitter-go.wasm",
    tags: ["tree-sitter-go/queries/tags.scm"],
  },
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
      const language = await Language.load(require.resolve(wasm));
      const scm = await Promise.all(
        tags.map((t) => readFile(require.resolve(t), "utf8")),
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

/** The tagged definition nodes, each once, in file order. */
function definitions(query: Query, root: Node): Node[] {
  const byId = new Map<number, Node>();
  for (const match of query.matches(root)) {
    const def = match.captures.find((c) => c.name.startsWith("definition."));
    if (def) byId.set(def.node.id, def.node);
  }
  return [...byId.values()].sort((a, b) => a.startIndex - b.startIndex);
}

/** `line: signature` for each definition, indented under the ones holding it. */
export async function outline(path: string): Promise<string> {
  const name = BY_EXTENSION[extname(path).toLowerCase()];
  if (!name) {
    throw new Error(
      `No outline for ${extname(path) || "this kind of"} files; read it instead.`,
    );
  }
  const { parser, query } = await grammar(name);
  const source = await readFile(path, "utf8");
  const sourceLines = source.split("\n");
  const tree = parser.parse(source);
  if (!tree) throw new Error(`Couldn't parse ${path}.`);
  const defs = definitions(query, tree.rootNode);
  const lines = defs.map((node) => {
    const depth = defs.filter(
      (o) =>
        o !== node &&
        o.startIndex <= node.startIndex &&
        o.endIndex >= node.endIndex,
    ).length;
    const row = node.startPosition.row;
    const head = sourceLines[row].trim().slice(0, 120);
    return `${row + 1}: ${"  ".repeat(depth)}${head}`;
  });
  tree.delete();
  return lines.join("\n") || "No definitions found; read it instead.";
}
