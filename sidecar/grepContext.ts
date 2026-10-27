/** grep's hits in their code: the definition holding each, whole when there are few; and what an empty search may have meant. */
import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { definitionsAt, outlines, type Definition } from "./outline.ts";

/** pi's grep text when nothing matched. */
export const NO_MATCHES = "No matches found";

const MAX_FILES = 30;
// Generated and minified files: parsing one to label a line costs more than it gives.
const MAX_FILE_BYTES = 512 * 1024;
// pi caps grep's output at 50KB; labels stay off a result they'd push past it.
const MAX_OUTPUT_CHARS = 50 * 1024;
const LABEL_CHARS = 40;
// Few enough that their code saves the read that would follow, small enough not to flood the context.
const SHOWN_HITS = 3;
const SHOWN_DEFINITIONS = 2;
const SHOWN_LINES = 60;

type Hit = { file: string; line: number };
type Found = { hit: Hit; def: Definition };

const HIT = /^(.+?):(\d+): /;
// pi writes context lines as `file-N- text`; one whose text holds `:N: ` isn't a hit.
const CONTEXT = /^(.+?)-(\d+)- /;

function hitOf(line: string): Hit | undefined {
  const m = HIT.exec(line);
  if (!m) return undefined;
  const context = CONTEXT.exec(line);
  if (context && context[0].length < m[0].length) return undefined;
  return { file: m[1]!, line: Number(m[2]) };
}

const small = (path: string) =>
  stat(path).then(
    (s) => s.size <= MAX_FILE_BYTES,
    () => false,
  );

async function definitionsOf(hits: Hit[], fileOf: (f: string) => string) {
  const named = [...new Set(hits.map((h) => h.file))].filter(outlines);
  const sized = await Promise.all(named.map((f) => small(fileOf(f))));
  const files = named.filter((_, i) => sized[i]).slice(0, MAX_FILES);
  const byFile = new Map<string, Map<number, Definition>>();
  await Promise.all(
    files.map(async (file) => {
      const lines = hits.filter((h) => h.file === file).map((h) => h.line);
      byFile.set(
        file,
        await definitionsAt(fileOf(file), lines).catch(() => new Map()),
      );
    }),
  );
  return (hit: Hit) => byFile.get(hit.file)?.get(hit.line);
}

// The definitions' code, numbered like read's, when the hits are few and they're short.
async function shownCode(found: Found[], fileOf: (f: string) => string) {
  const unique = [
    ...new Map(found.map((f) => [`${f.hit.file}:${f.def.start}`, f])).values(),
  ];
  const short = unique.every((f) => f.def.end - f.def.start < SHOWN_LINES);
  if (unique.length > SHOWN_DEFINITIONS || !short) return "";
  const parts = await Promise.all(
    unique.map(async ({ hit, def }) => {
      const lines = (await readFile(fileOf(hit.file), "utf8")).split(/\r?\n/);
      const code = lines
        .slice(def.start - 1, def.end)
        .map((l, i) => `${def.start + i}\t${l}`);
      return `${hit.file} (${def.name}, lines ${def.start}-${def.end}):\n${code.join("\n")}`;
    }),
  );
  return `\n\n[The code holding these hits:]\n\n${parts.join("\n\n")}`;
}

// As pi's grep reads its path: a leading `@` dropped, `~` the home folder.
const searched = (cwd: string, path: string) =>
  resolve(cwd, path.replace(/^@/, "").replace(/^~(?=\/|$)/, homedir()));

/** grep's `output` (searched at `path` from `cwd`), each hit with the definition holding it, and their code when there are few. */
export async function inContext(
  output: string,
  cwd: string,
  path = ".",
): Promise<string> {
  const lines = output.split("\n");
  const hits = lines.flatMap((l) => hitOf(l) ?? []);
  if (!hits.length) return output;
  if (output.length + hits.length * LABEL_CHARS > MAX_OUTPUT_CHARS)
    return output;
  const root = searched(cwd, path);
  const inFolder = (await stat(root).catch(() => null))?.isDirectory();
  const fileOf = (file: string) => (inFolder ? join(root, file) : root);
  const defOf = await definitionsOf(hits, fileOf);
  const labelled = lines.map((l) => {
    const hit = hitOf(l);
    const def = hit && defOf(hit);
    return def ? `${l}  [in ${def.name}, lines ${def.start}-${def.end}]` : l;
  });
  const found = hits.flatMap((hit) => {
    const def = defOf(hit);
    return def ? [{ hit, def }] : [];
  });
  const code =
    hits.length <= SHOWN_HITS && found.length === hits.length
      ? await shownCode(found, fileOf).catch(() => "")
      : "";
  return labelled.join("\n") + code;
}

type Search = { pattern: string; glob?: string; ignoreCase?: boolean };

/**
 * What an empty search may have meant, in order: ignoring case, then outside the glob that
 * narrowed it (never one that excluded files); each with the note that keeps "no matches" first.
 */
export function retries<S extends Search>(
  input: S,
  typedGlob = input.glob,
): { input: S; note: string; files?: boolean }[] {
  // Letters only in escapes (\d, \s) read the same in any case.
  const letters = /[A-Za-z]/.test(input.pattern.replace(/\\./g, ""));
  const caseless = !input.ignoreCase && letters;
  const narrowed = !!input.glob && !input.glob.startsWith("!");
  return [
    ...(caseless
      ? [
          {
            input: { ...input, ignoreCase: true },
            note: `${NO_MATCHES}. Ignoring case, it appears in:`,
            files: true,
          },
        ]
      : []),
    ...(narrowed
      ? [
          {
            input: { ...input, glob: undefined },
            note: `${NO_MATCHES} in files matching ${typedGlob}. In other files:`,
          },
        ]
      : []),
  ];
}
