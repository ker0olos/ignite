import { describe, expect, it, vi } from "vitest";
import {
  commit,
  extendMark,
  exportRatio,
  fitScale,
  isEmpty,
  worthKeeping,
  markupKey,
  NO_MARKS,
  pngImage,
  redo,
  startMark,
  strokeWidth,
  TOOL_KEY,
  undo,
  type Mark,
  MARKUP_FONT,
  textWidth,
} from "@/lib/markup";

const mark = (kind: Mark["kind"]) =>
  startMark("a", kind, { x: 10, y: 20 }, "#f00", 4);

describe("strokeWidth", () => {
  it("scales with the image and the size, never under 2px at medium", () => {
    expect(strokeWidth({ width: 1000, height: 500 }, "m")).toBe(4);
    expect(strokeWidth({ width: 1000, height: 500 }, "l")).toBe(8);
    expect(strokeWidth({ width: 40, height: 40 }, "m")).toBe(2);
    expect(strokeWidth({ width: 40, height: 40 }, "s")).toBe(1);
  });
});

describe("startMark and extendMark", () => {
  it("starts a pen stroke as a dot and grows it from its origin", () => {
    const pen = mark("pen");
    expect(pen).toMatchObject({ x: 10, y: 20, points: [0, 0, 0, 0] });
    expect(extendMark(pen, { x: 15, y: 18 }).points).toEqual([
      0, 0, 0, 0, 5, -2,
    ]);
  });

  it("points an arrow at the pointer", () => {
    const arrow = extendMark(mark("arrow"), { x: 30, y: 25 });
    expect(arrow.points).toEqual([0, 0, 20, 5]);
    expect(extendMark(arrow, { x: 0, y: 0 }).points).toEqual([0, 0, -10, -20]);
  });

  it("spans a box or ellipse to the pointer, backwards too", () => {
    expect(extendMark(mark("rect"), { x: 0, y: 50 })).toMatchObject({
      width: -10,
      height: 30,
    });
    expect(extendMark(mark("ellipse"), { x: 20, y: 30 })).toMatchObject({
      width: 10,
      height: 10,
    });
  });

  it("leaves text where it was placed", () => {
    const text = mark("text");
    expect(extendMark(text, { x: 99, y: 99 })).toBe(text);
  });
});

describe("isEmpty", () => {
  it("drops stray clicks with shape tools and blank text, keeps pen dots", () => {
    expect(isEmpty(mark("pen"))).toBe(false);
    expect(isEmpty(mark("highlighter"))).toBe(false);
    expect(isEmpty(mark("arrow"))).toBe(true);
    expect(isEmpty(extendMark(mark("arrow"), { x: 30, y: 20 }))).toBe(false);
    expect(isEmpty(extendMark(mark("rect"), { x: 13, y: 23 }))).toBe(true);
    expect(isEmpty(extendMark(mark("ellipse"), { x: 30, y: 40 }))).toBe(false);
    expect(isEmpty({ ...mark("text"), text: "  \n" })).toBe(true);
    expect(isEmpty({ ...mark("text"), text: "hi" })).toBe(false);
  });
});

describe("worthKeeping", () => {
  // Size 4, so a stroke needs 32px of length to count.
  const pen = (...to: [number, number][]) =>
    to.reduce((m, [x, y]) => extendMark(m, { x, y }), mark("pen"));

  it("ignores no marks, dots and short flicks", () => {
    expect(worthKeeping([])).toBe(false);
    expect(worthKeeping([mark("pen"), mark("highlighter")])).toBe(false);
    expect(worthKeeping([pen([20, 20], [30, 20])])).toBe(false);
  });

  it("keeps a real stroke, measured along its path, and any shape or text", () => {
    expect(worthKeeping([pen([50, 20])])).toBe(true);
    expect(worthKeeping([pen([30, 20], [10, 20], [30, 20])])).toBe(true);
    expect(
      worthKeeping([mark("pen"), extendMark(mark("rect"), { x: 50, y: 50 })]),
    ).toBe(true);
    expect(worthKeeping([{ ...mark("text"), text: "hi" }])).toBe(true);
  });
});

describe("history", () => {
  it("undoes and redoes, and a new change drops redo", () => {
    const a = [mark("pen")];
    const b = [...a, { ...mark("rect"), id: "b" }];
    let h = commit(commit(NO_MARKS, a), b);
    expect(h.present).toBe(b);
    h = undo(h);
    expect(h.present).toBe(a);
    h = redo(h);
    expect(h.present).toBe(b);
    h = commit(undo(h), []);
    expect(h.future).toEqual([]);
    expect(redo(h)).toBe(h);
  });

  it("ignores undo with nothing done and a commit that changes nothing", () => {
    expect(undo(NO_MARKS)).toBe(NO_MARKS);
    expect(commit(NO_MARKS, NO_MARKS.present)).toBe(NO_MARKS);
  });
});

describe("fitScale", () => {
  it("shrinks to the tighter side and never enlarges", () => {
    const box = { width: 900, height: 600 };
    expect(fitScale({ width: 1800, height: 600 }, box)).toBe(0.5);
    expect(fitScale({ width: 300, height: 1200 }, box)).toBe(0.5);
    expect(fitScale({ width: 100, height: 100 }, box)).toBe(1);
  });

  it("enlarges a vector image to fill the box", () => {
    const box = { width: 900, height: 600 };
    expect(fitScale({ width: 300, height: 100 }, box, true)).toBe(3);
    expect(fitScale({ width: 1800, height: 600 }, box, true)).toBe(0.5);
  });
});

describe("exportRatio", () => {
  it("exports a shrunk image at its own size, whole pixels intact", () => {
    expect(Math.floor(702 * exportRatio(0.702))).toBe(1000);
  });

  it("exports an enlarged image at the size it was drawn on", () => {
    expect(Math.floor(exportRatio(3))).toBe(1);
  });
});

describe("markupKey", () => {
  const key = (k: string, mods: Partial<Record<string, boolean>> = {}) =>
    markupKey({
      key: k,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      ...mods,
    });

  it("maps tool letters, and shows them upper-case", () => {
    expect(key("p")).toEqual({ tool: "pen" });
    expect(key("R")).toEqual({ tool: "rect" });
    expect(key("x")).toBeNull();
    expect(key("p", { shiftKey: true })).toBeNull();
    expect(key("p", { altKey: true })).toBeNull();
    expect(TOOL_KEY.ellipse).toBe("O");
  });

  it("maps ⌘Z / Ctrl+Z to undo, with shift or Y to redo", () => {
    expect(key("z", { metaKey: true })).toBe("undo");
    expect(key("Z", { metaKey: true, shiftKey: true })).toBe("redo");
    expect(key("y", { ctrlKey: true })).toBe("redo");
    expect(key("p", { metaKey: true })).toBeNull();
  });

  it("maps ⌘+ / ⌘= / ⌘- / ⌘0 to zoom", () => {
    expect(key("=", { metaKey: true })).toBe("zoomIn");
    expect(key("+", { metaKey: true, shiftKey: true })).toBe("zoomIn");
    expect(key("-", { ctrlKey: true })).toBe("zoomOut");
    expect(key("0", { metaKey: true })).toBe("zoomReset");
  });

  it("maps ⌘Enter to done, plain Enter to nothing", () => {
    expect(key("Enter", { metaKey: true })).toBe("done");
    expect(key("Enter", { ctrlKey: true })).toBe("done");
    expect(key("Enter")).toBeNull();
  });

  it("leaves Esc and Backspace to the rest of the app", () => {
    expect(key("Escape")).toBeNull();
    expect(key("Backspace")).toBeNull();
    expect(key("v")).toBeNull();
  });
});

describe("pngImage", () => {
  it("takes the base64 out of a data URL", () => {
    expect(pngImage("data:image/png;base64,QUJD")).toEqual({
      type: "image",
      data: "QUJD",
      mimeType: "image/png",
    });
  });
});

describe("textWidth", () => {
  it("fits the widest line, with room for the caret", () => {
    const measureText = (t: string) => ({ width: t.length * 5 });
    const ctx = {
      font: "",
      measureText,
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx);
    expect(textWidth(["ab", "abcdefgh"], 20)).toBe(8 * 5 + 5);
    expect(ctx.font).toBe(`500 20px ${MARKUP_FONT}`);
    vi.restoreAllMocks();
  });

  it("estimates where canvas can't measure", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    expect(textWidth(["abcd"], 10)).toBe(4 * 6 + 2.5);
    vi.restoreAllMocks();
  });

  it("keeps an empty box two text heights wide", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    expect(textWidth([""], 10)).toBe(20);
    vi.restoreAllMocks();
  });
});
