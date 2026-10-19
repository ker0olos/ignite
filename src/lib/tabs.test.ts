import { describe, expect, it } from "vitest";
import {
  activateDocked,
  closeDocked,
  closeTab,
  dockOf,
  moveTab,
  neighbour,
  NO_DOCKS,
  openDocked,
  openTab,
  type Docks,
} from "./tabs";

describe("openTab", () => {
  it("appends a new file and activates it", () => {
    expect(openTab({ files: ["a"], active: "a" }, "b")).toEqual({
      files: ["a", "b"],
      active: "b",
    });
  });

  it("activates an already open file without duplicating it", () => {
    expect(openTab({ files: ["a", "b"], active: "b" }, "a")).toEqual({
      files: ["a", "b"],
      active: "a",
    });
  });
});

describe("closeTab", () => {
  it("keeps the active tab when closing another one", () => {
    expect(closeTab({ files: ["a", "b", "c"], active: "a" }, "c")).toEqual({
      files: ["a", "b"],
      active: "a",
    });
  });

  it("activates the tab to the right when closing the active one", () => {
    expect(closeTab({ files: ["a", "b", "c"], active: "b" }, "b")).toEqual({
      files: ["a", "c"],
      active: "c",
    });
  });

  it("activates the new last tab when closing the active last one", () => {
    expect(closeTab({ files: ["a", "b", "c"], active: "c" }, "c")).toEqual({
      files: ["a", "b"],
      active: "b",
    });
  });

  it("clears the active tab when closing the only one", () => {
    expect(closeTab({ files: ["a"], active: "a" }, "a")).toEqual({
      files: [],
      active: null,
    });
  });

  it("ignores a path that is not open", () => {
    const tabs = { files: ["a"], active: "a" };
    expect(closeTab(tabs, "zzz")).toEqual(tabs);
  });
});

describe("neighbour", () => {
  it("is the right-hand neighbour, else the left, else nothing", () => {
    expect(neighbour(["a", "b", "c"], "b")).toBe("c");
    expect(neighbour(["a", "b", "c"], "c")).toBe("b");
    expect(neighbour(["a", "b", "c"], "a")).toBe("b");
    expect(neighbour(["a", "b"], "gone")).toBe("b");
    expect(neighbour(["a"], "a")).toBeNull();
  });
});

const docks = (
  side: string[],
  bottom: string[],
  focus: Docks["focus"] = "side",
): Docks => ({
  side: { files: side, active: side.at(-1) ?? null },
  bottom: { files: bottom, active: bottom.at(-1) ?? null },
  focus,
});

describe("docked tabs", () => {
  it("opens a new tab beside the conversation", () => {
    expect(openDocked(docks([], ["b"], "bottom"), "a")).toEqual({
      ...docks(["a"], ["b"]),
      focus: "side",
    });
  });

  it("opens an already docked tab where it is", () => {
    const d = openDocked(docks(["a"], ["b", "c"]), "b");
    expect(d.bottom).toEqual({ files: ["b", "c"], active: "b" });
    expect(d.focus).toBe("bottom");
  });

  it("finds a tab's dock", () => {
    expect(dockOf(docks(["a"], ["b"]), "b")).toBe("bottom");
    expect(dockOf(docks(["a"], ["b"]), "z")).toBeNull();
  });

  it("moves focus off a dock its last tab closed from", () => {
    expect(closeDocked(docks(["a"], ["b"], "bottom"), "b")).toEqual(
      docks(["a"], [], "side"),
    );
    expect(closeDocked(docks(["a"], ["b"]), "b").focus).toBe("side");
  });

  it("activates a tab in its dock, and ignores one not open", () => {
    const d = activateDocked(docks(["a", "b"], ["c"], "bottom"), "a");
    expect(d.side.active).toBe("a");
    expect(d.focus).toBe("side");
    expect(activateDocked(NO_DOCKS, "z")).toBe(NO_DOCKS);
  });

  it("reorders within a dock, counting the index with the tab in place", () => {
    const d = docks(["a", "b", "c"], []);
    expect(moveTab(d, "a", "side", 2).side.files).toEqual(["b", "a", "c"]);
    expect(moveTab(d, "a", "side", 3).side.files).toEqual(["b", "c", "a"]);
    expect(moveTab(d, "c", "side", 0).side.files).toEqual(["c", "a", "b"]);
  });

  it("moves a tab to the other dock and shows it there", () => {
    expect(moveTab(docks(["a", "b"], ["c"]), "a", "bottom", 1)).toEqual({
      side: { files: ["b"], active: "b" },
      bottom: { files: ["c", "a"], active: "a" },
      focus: "bottom",
    });
  });

  it("doesn't bring back a tab closed mid-drag", () => {
    const d = docks(["a"], []);
    expect(moveTab(d, "gone", "bottom", 0)).toBe(d);
  });
});
