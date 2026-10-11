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

/** `line: signature` for each definition, indented under the ones holding it. */
export async function outline(path: string): Promise<string> {
  const { source, tree, defs } = await parsed(path);
  const sourceLines = source.split("\n");
  const lines = defs.map(({ node }) => {
    const depth = defs.filter((o) => holds(o.node, node)).length;
    const row = node.startPosition.row;
    const head = sourceLines[row].trim().slice(0, 120);
    return `${row + 1}: ${"  ".repeat(depth)}${head}`;
  });
  tree.delete();
  return lines.join("\n") || "No definitions found; read it instead.";
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
