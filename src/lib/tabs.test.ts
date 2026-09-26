import { describe, expect, it } from "vitest";
import { closeTab, openTab } from "./tabs";

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
