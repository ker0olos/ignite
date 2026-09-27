/**
 * Parses shell commands with tree-sitter's bash grammar, so the approval
 * rules see each command's real words instead of guessing from raw text.
 */
import { createRequire } from "node:module";
import { basename } from "node:path";
import { Language, Parser, type Node } from "web-tree-sitter";
import type {
  ParseBash,
  Pipeline,
  SimpleCommand,
} from "../src/lib/dangerousCommands.ts";

const SHELLS = new Set(["sh", "bash", "zsh", "dash", "ksh", "fish"]);
// Words that run the rest of the line as a command.
const WRAPPERS = new Set(["sudo", "doas", "env", "command", "exec", "nohup"]);

class Unparsable extends Error {}

// Separators inside quotes are text, not shell syntax.
const flatten = (text: string) => text.replace(/[;&|<>\n]/g, " ");
const unescape = (text: string) => text.replace(/\\(?=[^\n])/g, "");

/** A word's value with its quoting removed; `flat` blanks quoted separators. */
function value(node: Node, flat = true): string {
  const text = (t: string) => (flat ? flatten(t) : t);
  switch (node.type) {
    case "word":
      return text(unescape(node.text));
    case "raw_string":
    case "ansi_c_string":
      return text(node.text.replace(/^\$?'|'$/g, ""));
    case "string":
      return node.namedChildren
        .map((c) =>
          c?.type === "string_content" ? text(unescape(c.text)) : c?.text,
        )
        .join("");
    case "concatenation":
    case "command_name":
      return node.namedChildren.map((c) => (c ? value(c, flat) : "")).join("");
    default:
      return node.text;
  }
}

const present = <T>(x: T | null | undefined): x is T => x != null;

function simple(node: Node): SimpleCommand {
  const name = node.childForFieldName("name");
  const args = node.childrenForFieldName("argument");
  const words = [name, ...args].filter(present).map((n) => value(n));
  return { words, redirects: [] };
}

/** The command a stage runs and its file redirects, or null for other syntax. */
function stage(node: Node): SimpleCommand | null {
  if (node.type === "command") return simple(node);
  if (node.type !== "redirected_statement") return null;
  const body = node.childForFieldName("body");
  const command =
    body?.type === "command" ? simple(body) : { words: [], redirects: [] };
  for (const redirect of node.childrenForFieldName("redirect")) {
    const target = redirect?.childForFieldName("destination");
    if (!redirect || redirect.type !== "file_redirect" || !target) continue;
    const operator = redirect.text.slice(
      0,
      target.startIndex - redirect.startIndex,
    );
    command.redirects.push({
      operator: operator.trim(),
      target: value(target),
    });
  }
  return command;
}

/** Where the command itself starts, after wrappers (sudo, env, VAR=x, flags). */
const commandStart = (words: string[]) =>
  words.findIndex(
    (w) => !WRAPPERS.has(w) && !w.startsWith("-") && !w.includes("="),
  );

/** Code a command runs from a string: `bash -c "…"`, `eval …`, or a heredoc fed to a shell. */
function nestedCode(node: Node): string[] {
  const command =
    node.type === "redirected_statement"
      ? node.childForFieldName("body")
      : node;
  if (command?.type !== "command") return [];
  const nodes = [
    command.childForFieldName("name"),
    ...command.childrenForFieldName("argument"),
  ].filter(present);
  const words = nodes.map((n) => value(n, false));
  const [name = "", ...args] = words.slice(Math.max(commandStart(words), 0));
  if (name === "eval") return [args.join(" ")];
  if (!SHELLS.has(basename(name))) return [];
  const flag = args.findIndex((a) => /^-\w*c\w*$/.test(a));
  const heredocs = node
    .descendantsOfType(["heredoc_body", "herestring_redirect"])
    .filter(present)
    .map((h) => {
      const word = h.type === "herestring_redirect" ? h.namedChildren[0] : h;
      return word ? value(word, false) : "";
    });
  return [flag >= 0 ? args[flag + 1] : "", ...heredocs]
    .filter(present)
    .filter(Boolean);
}

const inPipeline = (node: Node) =>
  node.parent?.type === "pipeline" ||
  (node.type === "command" && node.parent?.type === "redirected_statement");

/** The pipeline this node starts, if it is a pipeline or a command of its own. */
function pipelineAt(node: Node): Pipeline | null {
  if (node.type === "pipeline") {
    return node.namedChildren.filter(present).map(stage).filter(present);
  }
  const command = inPipeline(node) ? null : stage(node);
  return command && [command];
}

/** A command with its redirects, counted once (not again as its bare body). */
const isStatement = (node: Node) =>
  node.type === "redirected_statement" ||
  (node.type === "command" && node.parent?.type !== "redirected_statement");

function visit(
  node: Node,
  parse: (code: string) => Pipeline[],
  out: Pipeline[],
) {
  const pipeline = pipelineAt(node);
  if (pipeline) out.push(pipeline);
  if (isStatement(node)) {
    for (const code of nestedCode(node)) out.push(...parse(code));
  }
  for (const child of node.namedChildren) {
    if (child && child.type !== "heredoc_body") visit(child, parse, out);
  }
}

/** Loads the grammar once; the result parses a command into its pipelines. */
export async function loadBashParser(): Promise<ParseBash> {
  await Parser.init();
  const wasm = createRequire(import.meta.url).resolve(
    "tree-sitter-bash/tree-sitter-bash.wasm",
  );
  const parser = new Parser();
  parser.setLanguage(await Language.load(wasm));

  const parse = (code: string): Pipeline[] => {
    const tree = parser.parse(code);
    if (!tree || tree.rootNode.hasError) throw new Unparsable();
    const out: Pipeline[] = [];
    visit(tree.rootNode, parse, out);
    tree.delete();
    return out;
  };
  return (command) => {
    try {
      return parse(command);
    } catch (error) {
      if (error instanceof Unparsable) return null;
      throw error;
    }
  };
}
