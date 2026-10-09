import { Language, Parser } from "web-tree-sitter";
import bashWasm from "tree-sitter-bash/tree-sitter-bash.wasm?url";
import runtimeWasm from "web-tree-sitter/web-tree-sitter.wasm?url";

let parser: Promise<Parser> | undefined;

function bash() {
  parser ??= (async () => {
    await Parser.init({ locateFile: () => runtimeWasm });
    const p = new Parser();
    p.setLanguage(await Language.load(bashWasm));
    return p;
  })();
  return parser;
}

// A program's name or path; prose ("Run the tests") and output ("52 passed") start otherwise.
const PROGRAM = /^(?:~|\.{1,2})?\/?[a-z_][\w.+@/-]*$/;
// Other languages' code that bash also parses (`const a = { b: 1 };`).
// ponytail: a keyword list; checking the name is on PATH via the sidecar if it misfires.
const KEYWORDS = new Set(
  "const let var import export from def class return print public private fn use package func val type interface struct enum await yield".split(
    " ",
  ),
);
const isProgram = (name: string) => PROGRAM.test(name) && !KEYWORDS.has(name);

/** Whether untagged code reads as shell commands: bash parses it cleanly and every command names a program. */
export async function looksLikeShell(code: string): Promise<boolean> {
  if (!code.trim()) return false;
  try {
    const tree = (await bash()).parse(code);
    if (!tree) return false;
    try {
      if (tree.rootNode.hasError) return false;
      const names = tree.rootNode.descendantsOfType("command_name");
      return names.length > 0 && names.every((n) => isProgram(n!.text));
    } finally {
      tree.delete();
    }
  } catch {
    return false;
  }
}
