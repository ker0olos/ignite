/** Bash commands that only search or read the folder's files, which the grep and read tools do in fewer turns. */
import { isAbsolute, relative, resolve } from "node:path";
import type { Pipeline, SimpleCommand } from "../src/lib/dangerousCommands.ts";

type Redirect = SimpleCommand["redirects"][number];

const SEARCHES = new Set([
  "grep",
  "egrep",
  "fgrep",
  "rg",
  "ag",
  "cat",
  "head",
  "tail",
  "sed",
  "nl",
]);
// Allowed beside a search, never redirected on their own.
const HELPERS = new Set([
  "cd",
  "ls",
  "find",
  "wc",
  "sort",
  "uniq",
  "cut",
  "echo",
]);
// Options that write files, run other programs or follow a file (tail -f), which no tool does.
const WRITES: Record<string, RegExp> = {
  sed: /^-(\w*i|-in-place)|(^|[;}\s/])w\s*\S/,
  find: /^-(exec|execdir|delete|ok|okdir|fprint|fls)/,
  tail: /^-(\w*[fF]|-follow)/,
};

export const USE_READ_TOOLS =
  "Search and read files with the grep and read tools, not grep, rg, cat, sed, head or tail in bash. " +
  "grep takes a ripgrep pattern (a|b, not a\\|b), a path, a glob, context lines and filesOnly; " +
  "read takes offset and limit, symbol for one definition, and also for more files or ranges in the same call. " +
  "After an edit, its result already shows the changed lines with their numbers.";

/** Whether `word` (or an option's `=value`) names a path outside `cwd`, or one only the shell expands. */
function outside(word: string, cwd: string): boolean {
  if (word.includes("$") || word.startsWith("~")) return true;
  const value = word.startsWith("-") ? word.split("=")[1] : word;
  if (!value || (!isAbsolute(value) && !value.startsWith(".."))) return false;
  return relative(cwd, resolve(cwd, value)).startsWith("..");
}

// `2>&1` duplicates a stream (its target a number); `>& out.txt` writes a file.
const writesFile = ({ operator, target }: Redirect) =>
  !operator.startsWith("<") &&
  target !== "/dev/null" &&
  !/^\d+$|^-$/.test(target);

/** Whether a command only searches, reads or lists files in `cwd`. */
function readsOnly(
  { words: [program = "", ...args], redirects }: SimpleCommand,
  cwd: string,
) {
  const writes = WRITES[program];
  return (
    (SEARCHES.has(program) || HELPERS.has(program)) &&
    !redirects.some(writesFile) &&
    !args.some((a) => writes?.test(a) || outside(a, cwd))
  );
}

/** Whether every command is a file search or read in `cwd`, with nothing written. A search after a pipe filters
 *  another command's output (`ls | head`), which no tool does, so at least one must start its pipeline. */
export function onlySearches(pipelines: Pipeline[], cwd: string): boolean {
  return (
    pipelines.some((p) => SEARCHES.has(p[0]?.words[0] ?? "")) &&
    pipelines.flat().every((c) => readsOnly(c, cwd))
  );
}
