/** pi's edit, whose result shows the changed lines as they now read, numbered, so the agent needn't look them up again. */
import {
  createEditToolDefinition,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";

/** Lines an edit's result shows at most; past it, a note says where the rest is. */
const MAX_SHOWN = 80;

/** The new file's lines in a unified patch's hunks (context and added), numbered, `...` between hunks, capped at MAX_SHOWN. */
export function changedLines(patch: string): string {
  const hunks: string[][] = [];
  let next = 0;
  let shown = 0;
  for (const line of patch.split("\n")) {
    const header = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (header) {
      next = Number(header[1]);
      hunks.push([]);
    } else if (hunks.length && (line[0] === " " || line[0] === "+")) {
      if (shown === MAX_SHOWN) {
        hunks
          .at(-1)!
          .push(`[More changes from line ${next}; read the file to see them.]`);
        break;
      }
      hunks.at(-1)!.push(`${next++}\t${line.slice(1)}`);
      shown++;
    }
  }
  return hunks
    .filter((h) => h.length)
    .map((h) => h.join("\n"))
    .join("\n...\n");
}

/** Replaces pi's edit with one whose result shows the edited lines with their line numbers. */
export function registerEdit(pi: ExtensionAPI) {
  const builtin = createEditToolDefinition(process.cwd());
  pi.registerTool({
    ...builtin,
    description: `${builtin.description} The result shows the changed lines as they now read, numbered: edit again from them without reading or searching the file again.`,
    async execute(id, input, signal, onUpdate, ctx) {
      const done = await builtin.execute(id, input, signal, onUpdate, ctx);
      const shown = changedLines(done.details?.patch ?? "");
      if (!shown) return done;
      const [first, ...rest] = done.content;
      const text = `${first?.type === "text" ? first.text : ""} Now:\n${shown}`;
      return { ...done, content: [{ type: "text", text }, ...rest] };
    },
  });
}
