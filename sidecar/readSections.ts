/** read's arguments as models write them, and its text with numbered lines. */

const RANGE = /^\[?\s*(\d+)\s*(?:,|-|:|\.\.)\s*(\d+)\s*\]?$/;

/** A part whose offset came as text ("310", "[310, 330]", "310-330") with numbers instead. */
function fixRange(part: Record<string, unknown>) {
  const { offset } = part;
  if (typeof offset !== "string") return part;
  const range = RANGE.exec(offset.trim());
  if (range) {
    const [from, to] = [Number(range[1]), Number(range[2])];
    return { ...part, offset: from, limit: Math.max(1, to - from + 1) };
  }
  return /^\d+$/.test(offset.trim())
    ? { ...part, offset: Number(offset) }
    : part;
}

const parsedJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

/** read's arguments with text ranges and an `also` sent as a JSON string fixed, before validation. */
export function prepareRead(args: unknown) {
  if (!args || typeof args !== "object") return args;
  const fixed = fixRange(args as Record<string, unknown>);
  const also =
    typeof fixed.also === "string" ? parsedJson(fixed.also) : fixed.also;
  if (!Array.isArray(also)) return fixed;
  const parts = also.map((p: unknown) =>
    p && typeof p === "object" ? fixRange(p as Record<string, unknown>) : p,
  );
  return { ...fixed, also: parts };
}

/** pi's read text, which starts at line `first`, with each line numbered; its closing note left as is. */
export function numbered(text: string, first: number): string {
  if (text.startsWith("[Line ")) return text;
  const note = /\n\n\[[^\n]*\]$/.exec(text);
  const body = note ? text.slice(0, note.index) : text;
  const lines = body.split("\n");
  // Before a note, every line is the file's; at its end, "" is its last newline.
  const last =
    !note && lines.length > 1 && lines.at(-1) === "" ? lines.pop() : undefined;
  const shown = lines.map((line, i) => `${first + i}\t${line}`);
  if (last !== undefined) shown.push("");
  return shown.join("\n") + (note?.[0] ?? "");
}
