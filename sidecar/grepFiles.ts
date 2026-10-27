/** pi's grep with `filesOnly`: the files that match and how often, before reading any lines. */
import {
  createGrepToolDefinition,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { inContext, NO_MATCHES, retries } from "./grepContext.ts";
import { lineParts, spanningLines } from "./grepLines.ts";

/** Matches gathered for a file list; pi's 50KB output cap may end it sooner. */
const FILES_LIMIT = 1000;

const FILES_ONLY = Type.Optional(
  Type.Boolean({
    description:
      "List only the files that match, with match counts, not the lines. Use it first to see where something appears, then grep or read the files that matter.",
  }),
);

/** pi's `path:line: text` match lines as `path (count)`, most matches first. */
export function fileCounts(output: string, partial: boolean): string {
  const counts = new Map<string, number>();
  for (const line of output.split("\n")) {
    const file = /^(.+?):\d+: /.exec(line)?.[1];
    if (file) counts.set(file, (counts.get(file) ?? 0) + 1);
  }
  if (counts.size === 0) return output;
  const files = [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([file, n]) => `${file} (${n})`);
  const note = partial
    ? "\n\n[Too many matches to list every file; narrow the pattern, path or glob.]"
    : "";
  return `${counts.size} files:\n${files.join("\n")}${note}`;
}

// ripgrep matches a glob naming a folder (`lib/models.ts`) from its own working directory, which pi
// never sets, and takes no absolute glob. ponytail: `**/` also matches the folder deeper down
// (`packages/a/lib/models.ts`); anchoring it needs pi to run ripgrep from the searched path.
/** `glob` as matched under the searched path wherever its folders sit; a leading `!` (exclude) kept. */
export function searchGlob(glob: string): string {
  const not = glob.startsWith("!") ? "!" : "";
  const rest = glob.slice(not.length).replace(/^(?:\.\/|\/)+/, "");
  const asIs =
    !rest.includes("/") || rest.startsWith("**/") || rest.startsWith("../");
  return `${not}${asIs ? "" : "**/"}${rest}`;
}

/** Replaces pi's grep with one that also takes `filesOnly`, and patterns that span lines (`\n`). */
export function registerGrep(pi: ExtensionAPI) {
  const builtin = createGrepToolDefinition(process.cwd());
  pi.registerTool({
    ...builtin,
    parameters: Type.Object({
      ...builtin.parameters.properties,
      filesOnly: FILES_ONLY,
    }),
    async execute(id, { filesOnly, ...asked }, signal, onUpdate, ctx) {
      const input = {
        ...asked,
        ...(asked.glob && { glob: searchGlob(asked.glob) }),
      };
      const parts = lineParts(input.pattern, !!input.literal);
      if (parts) {
        const search = (pattern: string) =>
          builtin.execute(
            id,
            { ...input, pattern, context: 0, limit: FILES_LIMIT },
            signal,
            onUpdate,
            ctx,
          );
        return spanningLines(parts, input, search, ctx.cwd);
      }
      const search = (i: typeof input, files = filesOnly) =>
        builtin.execute(
          id,
          files ? { ...i, context: 0, limit: FILES_LIMIT } : i,
          signal,
          onUpdate,
          ctx,
        );
      // An empty search tries what it likely meant, saving the call that would look again.
      let done = await search(input);
      let [note, files] = ["", filesOnly];
      const empty = textOf(done) === NO_MATCHES;
      for (const retry of empty ? retries(input, asked.glob) : []) {
        const asFiles = filesOnly || !!retry.files;
        const again = await search(retry.input, asFiles);
        if (textOf(again) === NO_MATCHES) continue;
        [done, note, files] = [again, `${retry.note}\n`, asFiles];
        break;
      }
      const shown = files
        ? fileCounts(textOf(done), partial(done.details))
        : await inContext(textOf(done), ctx.cwd, input.path);
      return {
        ...done,
        content: [{ type: "text" as const, text: note + shown }],
      };
    },
  });
}

const textOf = (done: { content: unknown[] }) =>
  (done.content[0] as { text: string }).text;

const partial = (details: unknown) => {
  const d = details as { matchLimitReached?: number; truncation?: unknown };
  return !!(d?.matchLimitReached || d?.truncation);
};
