/** pi's read with numbered lines, a smaller default window, definitions by name and several parts per call; and `outline`. */
import { isAbsolute, resolve } from "node:path";
import {
  createReadToolDefinition,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { outline, outlines, symbolLines } from "./outline.ts";
import { numbered, prepareRead } from "./readSections.ts";

/** Lines a read shows without offset or limit; pi's own default is 2000. */
export const WINDOW = 400;

/** Parts one read may add with `also`. */
const MAX_ALSO = 10;

type Part = { path: string; offset?: number; limit?: number; symbol?: string };
type Builtin = ReturnType<typeof createReadToolDefinition>;
type Done = Awaited<ReturnType<Builtin["execute"]>>;
type Block = Done["content"][number];
type Run = (input: Part) => Promise<Done>;

const SYMBOL = Type.Optional(
  Type.String({
    description:
      'A function, class, method or type in the file, by name ("render", or "Box.open" for one inside Box): reads just its lines. Code files that outline reads.',
  }),
);

const ALSO = Type.Optional(
  Type.Array(
    Type.Object({
      path: Type.String(),
      offset: Type.Optional(Type.Number()),
      limit: Type.Optional(Type.Number()),
      symbol: SYMBOL,
    }),
    {
      maxItems: MAX_ALSO,
      description:
        "More files, ranges or definitions to read in this same call, each like the main one.",
    },
  ),
);

/** A range read through pi's read, its text numbered from its first line. */
async function range(run: Run, part: Part): Promise<Done> {
  const windowed = part.limit === undefined;
  const done = await run(windowed ? { ...part, limit: WINDOW } : part);
  const [block, ...rest] = done.content;
  if (block?.type !== "text" || rest.some((b) => b.type === "image")) {
    return done;
  }
  let text = numbered(block.text, part.offset ?? 1);
  if (
    windowed &&
    outlines(part.path) &&
    /more lines in file\. Use offset=\d+ to continue\.\]$/.test(text)
  ) {
    text += "\n[Or outline it to find the part you need.]";
  }
  return { ...done, content: [{ ...block, text }, ...rest] };
}

const MORE = /\n\n\[\d+ more lines in file\. Use offset=\d+ to continue\.\]$/;

/** `content` under a `--- head ---` line; `whole` drops the note that more lines follow. */
function headed(head: string, content: Block[], whole = false): Block[] {
  const [first, ...rest] = content;
  if (first?.type !== "text") return [{ type: "text", text: head }, ...content];
  const text = whole ? first.text.replace(MORE, "") : first.text;
  return [{ ...first, text: `${head}\n${text}` }, ...rest];
}

/** A part as headed sections: its range, or each definition named `symbol`. */
async function sections(run: Run, part: Part, cwd: string): Promise<Block[]> {
  const { path, symbol } = part;
  if (!symbol) {
    return headed(`--- ${path} ---`, (await range(run, part)).content);
  }
  const file = isAbsolute(path) ? path : resolve(cwd, path);
  const found = await symbolLines(file, symbol);
  if (!found.length) {
    throw new Error(
      `No definition named ${symbol} in ${path}; outline it to see its definitions.`,
    );
  }
  const read = await Promise.all(
    found.map(async ({ start, end }) => {
      const { content } = await range(run, {
        path,
        offset: start,
        limit: end - start + 1,
      });
      return headed(
        `--- ${path} ${symbol} (lines ${start}-${end}) ---`,
        content,
        true,
      );
    }),
  );
  return read.flat();
}

/** Every part's sections, a part that fails saying why in its place; throws only when all fail. */
async function readAll(run: Run, parts: Part[], cwd: string): Promise<Done> {
  const settled = await Promise.allSettled(
    parts.map((p) => sections(run, p, cwd)),
  );
  if (settled.every((s) => s.status === "rejected")) {
    throw (settled[0] as PromiseRejectedResult).reason;
  }
  const blocks = settled.flatMap((s, i): Block[] =>
    s.status === "fulfilled"
      ? s.value
      : [
          {
            type: "text",
            text: `--- ${parts[i].path} ---\n${String(s.reason?.message ?? s.reason)}`,
          },
        ],
  );
  // Adjacent text joins into one block, so the model reads one result.
  const joined = blocks.reduce<Block[]>((out, b) => {
    const last = out.at(-1);
    if (b.type === "text" && last?.type === "text") {
      const text = `${last.text.trimEnd()}\n\n${b.text}`;
      out[out.length - 1] = { ...last, text };
    } else out.push(b);
    return out;
  }, []);
  return { content: joined, details: undefined };
}

/** Replaces pi's read with numbered lines, a WINDOW-line default, `symbol` and `also`. */
export function registerRead(pi: ExtensionAPI) {
  const builtin = createReadToolDefinition(process.cwd());
  pi.registerTool({
    ...builtin,
    description: `Read files. Text shows with line numbers (a number and a tab before each line; they aren't part of the file), ${WINDOW} lines from offset (default 1) unless you pass limit; a note says how many lines remain. Images (jpg, png, gif, webp, bmp) are sent as attachments. symbol reads one definition by name. Use also to read several files, ranges or definitions in one call instead of one read per turn. For a long code file, outline it first and read the part you need.`,
    parameters: Type.Object({
      ...builtin.parameters.properties,
      symbol: SYMBOL,
      also: ALSO,
    }),
    prepareArguments: prepareRead as never,
    async execute(id, { also = [], ...first }, signal, onUpdate, ctx) {
      const run: Run = (input) =>
        builtin.execute(id, input, signal, onUpdate, ctx);
      if (!also.length && !first.symbol) return range(run, first);
      return readAll(run, [first, ...also], ctx.cwd);
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
