/** pi's grep with `filesOnly`: the files that match and how often, before reading any lines. */
import {
  createGrepToolDefinition,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

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

/** Replaces pi's grep with one that also takes `filesOnly`. */
export function registerGrep(pi: ExtensionAPI) {
  const builtin = createGrepToolDefinition(process.cwd());
  pi.registerTool({
    ...builtin,
    parameters: Type.Object({
      ...builtin.parameters.properties,
      filesOnly: FILES_ONLY,
    }),
    async execute(id, { filesOnly, ...input }, signal, onUpdate, ctx) {
      if (!filesOnly) return builtin.execute(id, input, signal, onUpdate, ctx);
      const done = await builtin.execute(
        id,
        { ...input, context: 0, limit: FILES_LIMIT },
        signal,
        onUpdate,
        ctx,
      );
      const text = (done.content[0] as { text: string }).text;
      const details = done.details as
        { matchLimitReached?: number; truncation?: unknown } | undefined;
      const partial = !!(details?.matchLimitReached || details?.truncation);
      return {
        ...done,
        content: [{ type: "text" as const, text: fileCounts(text, partial) }],
      };
    },
  });
}
