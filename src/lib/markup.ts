/** What a pointer drag on the image draws. */
export type MarkupTool =
  "pen" | "highlighter" | "arrow" | "rect" | "ellipse" | "text";

export type MarkupSize = "s" | "m" | "l";

type Point = { x: number; y: number };

/** One drawn mark, in the image's own pixels: `points` and `width`/`height` are from `x, y`. */
export type Mark = {
  id: string;
  kind: MarkupTool;
  color: string;
  size: number;
  x: number;
  y: number;
  points: number[];
  width: number;
  height: number;
  text: string;
};

// Ink drawn into the image, not interface colours, so theme tokens don't apply.
export const MARKUP_COLORS = [
  "#ef4444",
  "#f59e0b",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#ffffff",
  "#000000",
];

export const MARKUP_SIZES: MarkupSize[] = ["s", "m", "l"];

const SIZE_FACTOR: Record<MarkupSize, number> = { s: 0.5, m: 1, l: 2 };

/** The font of text marks, in the editor and the saved image. */
export const MARKUP_FONT =
  "-apple-system, BlinkMacSystemFont, system-ui, sans-serif";

/** Text is this many times the stroke width tall. */
export const TEXT_SCALE = 10;

/** The weight of text marks, in the editor and the saved image. */
export const TEXT_WEIGHT = "500";

/** How wide text marks' `lines` are at `fontSize` px, with room for the caret, never under two text heights; estimated where canvas can't measure. */
export function textWidth(lines: string[], fontSize: number): number {
  const ctx = document.createElement("canvas").getContext("2d");
  if (ctx) ctx.font = `${TEXT_WEIGHT} ${fontSize}px ${MARKUP_FONT}`;
  const width = (line: string) =>
    ctx ? ctx.measureText(line).width : line.length * fontSize * 0.6;
  const widest = Math.max(...lines.map(width)) + fontSize * 0.25;
  return Math.max(fontSize * 2, widest);
}

/** A stroke width that looks the same on a small image or a 4K screenshot. */
export function strokeWidth(
  image: { width: number; height: number },
  size: MarkupSize,
) {
  return (
    Math.max(2, Math.max(image.width, image.height) / 250) * SIZE_FACTOR[size]
  );
}

/** A new mark of `kind` where the pointer went down. */
export function startMark(
  id: string,
  kind: MarkupTool,
  at: Point,
  color: string,
  size: number,
): Mark {
  return {
    id,
    kind,
    color,
    size,
    ...at,
    // Two points, so a click with the pen leaves a dot.
    points: [0, 0, 0, 0],
    width: 0,
    height: 0,
    text: "",
  };
}

/** `mark` drawn on to the pointer at `at`: a stroke grows, a shape spans to it. */
export function extendMark(mark: Mark, at: Point): Mark {
  const dx = at.x - mark.x;
  const dy = at.y - mark.y;
  if (mark.kind === "pen" || mark.kind === "highlighter")
    return { ...mark, points: [...mark.points, dx, dy] };
  if (mark.kind === "arrow") return { ...mark, points: [0, 0, dx, dy] };
  if (mark.kind === "text") return mark;
  return { ...mark, width: dx, height: dy };
}

/** Whether a finished mark is too small or blank to keep (a stray click with a shape tool). */
export function isEmpty(mark: Mark) {
  const min = mark.size * 2;
  if (mark.kind === "text") return !mark.text.trim();
  if (mark.kind === "arrow")
    return Math.hypot(mark.points[2], mark.points[3]) < min;
  if (mark.kind === "rect" || mark.kind === "ellipse")
    return Math.hypot(mark.width, mark.height) < min;
  return false;
}

// A pen or highlighter stroke shorter than this many widths is likely a slip.
const STRAY_LENGTH = 8;

const strokeLength = (points: number[]) => {
  let length = 0;
  for (let i = 2; i < points.length; i += 2)
    length += Math.hypot(
      points[i] - points[i - 2],
      points[i + 1] - points[i - 1],
    );
  return length;
};

/** Whether `marks` hold anything closing would lose, beyond stray dots and flicks. */
export function worthKeeping(marks: Mark[]) {
  return marks.some(
    (m) =>
      (m.kind !== "pen" && m.kind !== "highlighter") ||
      strokeLength(m.points) >= m.size * STRAY_LENGTH,
  );
}

/** Every version of the marks, for undo and redo. */
export type MarkupHistory = {
  past: Mark[][];
  present: Mark[];
  future: Mark[][];
};

export const NO_MARKS: MarkupHistory = { past: [], present: [], future: [] };

/** `history` with `marks` as the new present; redo is lost. */
export function commit(history: MarkupHistory, marks: Mark[]): MarkupHistory {
  if (marks === history.present) return history;
  return {
    past: [...history.past, history.present],
    present: marks,
    future: [],
  };
}

/** `history` one step back, if there is one. */
export function undo(history: MarkupHistory): MarkupHistory {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

/** `history` one undone step forward again, if there is one. */
export function redo(history: MarkupHistory): MarkupHistory {
  const [next, ...future] = history.future;
  if (!next) return history;
  return { past: [...history.past, history.present], present: next, future };
}

/**
 * How far to scale an image to fit `box`. Only a vector image is enlarged
 * to fill it, since its own size is just its viewBox.
 */
export function fitScale(
  image: { width: number; height: number },
  box: { width: number; height: number },
  vector = false,
) {
  const fill = Math.min(box.width / image.width, box.height / image.height);
  return vector ? fill : Math.min(1, fill);
}

/** The export's pixel ratio: the image's own size, or the shown size when enlarged. */
export function exportRatio(scale: number) {
  // The nudge stops 702 × (1 / 0.702) flooring to 999 instead of 1000 px.
  return Math.max(1, 1 / scale) + 1e-9;
}

const TOOL_KEYS: Record<string, MarkupTool> = {
  p: "pen",
  h: "highlighter",
  a: "arrow",
  r: "rect",
  o: "ellipse",
  t: "text",
};

/** The shortcut key for each tool, shown in its tooltip. */
export const TOOL_KEY = Object.fromEntries(
  Object.entries(TOOL_KEYS).map(([key, tool]) => [tool, key.toUpperCase()]),
) as Record<MarkupTool, string>;

/** What the markup editor does for a key press. */
export type MarkupKeyAction =
  | { tool: MarkupTool }
  | "undo"
  | "redo"
  | "zoomIn"
  | "zoomOut"
  | "zoomReset"
  | "done";

const COMMAND_KEYS: Record<string, MarkupKeyAction> = {
  y: "redo",
  "=": "zoomIn",
  "+": "zoomIn",
  "-": "zoomOut",
  "0": "zoomReset",
  enter: "done",
};

const commandKey = (key: string, shift: boolean): MarkupKeyAction | null => {
  if (key === "z") return shift ? "redo" : "undo";
  return COMMAND_KEYS[key] ?? null;
};

/** The editor's action for a key: tool letters, ⌘Z / ⇧⌘Z, ⌘+ / ⌘- / ⌘0 and ⌘Enter. */
export function markupKey(e: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): MarkupKeyAction | null {
  const key = e.key.toLowerCase();
  if (e.metaKey || e.ctrlKey) return commandKey(key, e.shiftKey);
  if (e.altKey || e.shiftKey) return null;
  const tool = TOOL_KEYS[key];
  return tool ? { tool } : null;
}

/** The image block in a PNG data URL. */
export function pngImage(dataUrl: string) {
  return {
    type: "image" as const,
    data: dataUrl.slice(dataUrl.indexOf(",") + 1),
    mimeType: "image/png",
  };
}
