import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useMarkup } from "@/hooks/useMarkup";

const setup = () =>
  renderHook(() => useMarkup({ width: 1000, height: 500 })).result;

type Result = ReturnType<typeof setup>;
const drag = (r: Result, from: number, to: number) => {
  act(() => r.current.begin({ x: from, y: from }));
  act(() => r.current.extend({ x: to, y: to }));
  act(() => r.current.end());
};

describe("useMarkup", () => {
  it("draws with the chosen tool, ink and size, and keeps only real marks", () => {
    const r = setup();
    expect(r.current.size).toBe("s");
    act(() => r.current.setTool("rect"));
    act(() => r.current.setColor("#000000"));
    act(() => r.current.setSize("l"));
    drag(r, 10, 100);
    drag(r, 10, 11);
    expect(r.current.marks).toHaveLength(1);
    expect(r.current.marks[0]).toMatchObject({
      kind: "rect",
      color: "#000000",
      size: 8,
      width: 90,
    });
    expect(r.current.draft).toBeNull();
    expect(r.current.canUndo).toBe(true);
  });

  it("drops a stroke a second finger cancels", () => {
    const r = setup();
    act(() => r.current.begin({ x: 10, y: 10 }));
    act(() => r.current.extend({ x: 90, y: 90 }));
    act(() => r.current.cancel());
    act(() => r.current.end());
    expect(r.current.marks).toEqual([]);
  });

  it("ignores moves between drags", () => {
    const r = setup();
    act(() => r.current.extend({ x: 5, y: 5 }));
    act(() => r.current.end());
    expect(r.current.marks).toEqual([]);
    expect(r.current.draft).toBeNull();
  });

  it("undoes and redoes marks", () => {
    const r = setup();
    drag(r, 10, 100);
    act(() => r.current.undo());
    expect(r.current.marks).toEqual([]);
    expect(r.current.canRedo).toBe(true);
    act(() => r.current.redo());
    expect(r.current.marks).toHaveLength(1);
    expect(r.current.canRedo).toBe(false);
  });

  it("types a text mark, and adds nothing for blank text or none being typed", () => {
    const r = setup();
    act(() => r.current.finishText());
    act(() => r.current.setTool("text"));
    act(() => r.current.begin({ x: 1, y: 1 }));
    act(() => r.current.type(" "));
    act(() => r.current.finishText());
    expect(r.current.marks).toEqual([]);

    act(() => r.current.begin({ x: 50, y: 60 }));
    expect(r.current.editing).toMatchObject({ kind: "text", x: 50 });
    act(() => r.current.type("Bug here"));
    act(() => r.current.finishText());
    expect(r.current.marks[0]).toMatchObject({ text: "Bug here" });
    expect(r.current.editing).toBeNull();
  });

  it("keeps typed text when a click lands elsewhere, and when its field blurs late", () => {
    const r = setup();
    act(() => r.current.setTool("text"));
    act(() => r.current.begin({ x: 10, y: 10 }));
    act(() => r.current.type("first"));
    const lateBlur = r.current.finishText;
    act(() => r.current.begin({ x: 200, y: 200 }));
    expect(r.current.editing).toBeNull();
    expect(r.current.marks.map((m) => m.text)).toEqual(["first"]);

    act(() => lateBlur());
    expect(r.current.marks).toHaveLength(1);
    act(() => r.current.begin({ x: 200, y: 200 }));
    expect(r.current.editing).toMatchObject({ x: 200 });
  });

  it("clears every mark in one undoable step", () => {
    const r = setup();
    act(() => r.current.clear());
    expect(r.current.canUndo).toBe(false);
    drag(r, 10, 100);
    drag(r, 20, 200);
    act(() => r.current.clear());
    expect(r.current.marks).toEqual([]);
    act(() => r.current.undo());
    expect(r.current.marks).toHaveLength(2);
  });

  it("runs keyboard actions, and says which it didn't handle", () => {
    const r = setup();
    drag(r, 10, 100);
    expect(r.current.act("zoomIn")).toBe(false);
    expect(r.current.act("done")).toBe(false);
    act(() => void r.current.act({ tool: "arrow" }));
    expect(r.current.tool).toBe("arrow");
    act(() => void r.current.act("undo"));
    expect(r.current.marks).toEqual([]);
    act(() => void r.current.act("redo"));
    expect(r.current.marks).toHaveLength(1);
  });
});
