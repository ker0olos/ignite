/** pi's read with a smaller default window, and `outline` for a code file's definitions. */
import { isAbsolute, resolve } from "node:path";
import {
  createReadToolDefinition,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { outline, outlines } from "./outline.ts";

/** Lines a read shows without offset or limit; pi's own default is 2000. */
export const WINDOW = 400;

/** Replaces pi's read with one that shows WINDOW lines unless told otherwise. */
export function registerRead(pi: ExtensionAPI) {
  const builtin = createReadToolDefinition(process.cwd());
  pi.registerTool({
    ...builtin,
    description: `Read a file. Text files show ${WINDOW} lines from offset (default 1) unless you pass limit; a note says how many lines remain. Images (jpg, png, gif, webp, bmp) are sent as attachments. For a long code file, outline it first and read the part you need.`,
    async execute(id, input, signal, onUpdate, ctx) {
      const windowed = input.limit === undefined;
      const done = await builtin.execute(
        id,
        windowed ? { ...input, limit: WINDOW } : input,
        signal,
        onUpdate,
        ctx,
      );
      const block = done.content[0];
      if (!windowed || block?.type !== "text" || !outlines(input.path)) {
        return done;
      }
      if (
        !/more lines in file\. Use offset=\d+ to continue\.\]$/.test(block.text)
      ) {
        return done;
      }
      const text = `${block.text}\n[Or outline it to find the part you need.]`;
      return {
        ...done,
        content: [{ ...block, text }, ...done.content.slice(1)],
      };
    },
  });
}

/** Registers `outline`: a code file's functions, classes and methods by line. */
export function registerOutline(pi: ExtensionAPI) {
  pi.registerTool({
    name: "outline",
    label: "Outline",
    description:
      "List a code file's definitions (functions, classes, methods, types) with their line numbers and first line, nested ones indented, without their bodies. Use it on a long file to find what to read. TypeScript, JavaScript, Python, Rust and Go.",
    promptSnippet:
      "outline: a code file's definitions by line, to find what to read",
    parameters: Type.Object({
      path: Type.String({ description: "The file, relative to the folder." }),
    }),
    async execute(_id, { path }, _signal, _onUpdate, ctx) {
      const file = isAbsolute(path) ? path : resolve(ctx.cwd, path);
      const text = await outline(file);
      return { content: [{ type: "text", text }], details: {} };
    },
  });
}
