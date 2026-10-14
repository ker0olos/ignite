import { beforeEach, describe, expect, it, vi } from "vitest";

type Module = typeof import("./openFolders");
let m: Module;
beforeEach(async () => {
  localStorage.clear();
  vi.resetModules();
  m = await import("./openFolders");
});

describe("openFolders", () => {
  it("remembers folders opened and closed, across loads", async () => {
    m.setFolderOpen("/a/src", true);
    m.setFolderOpen("/a/lib", true);
    m.setFolderOpen("/a/lib", false);
    vi.resetModules();
    const fresh: Module = await import("./openFolders");
    expect(fresh.isFolderOpen("/a/src")).toBe(true);
    expect(fresh.isFolderOpen("/a/lib")).toBe(false);
  });

  it("doesn't write over another window's folders", () => {
    m.isFolderOpen("/a");
    localStorage.setItem("file-tree-open", '["/other"]');
    m.setFolderOpen("/mine", true);
    expect(m.isFolderOpen("/other")).toBe(true);
    expect(m.isFolderOpen("/mine")).toBe(true);
  });

  it("reads again after another window saves", () => {
    expect(m.isFolderOpen("/b")).toBe(false);
    localStorage.setItem("file-tree-open", '["/b"]');
    window.dispatchEvent(
      new StorageEvent("storage", { key: "file-tree-open" }),
    );
    expect(m.isFolderOpen("/b")).toBe(true);
    window.dispatchEvent(new StorageEvent("storage", { key: "other" }));
    expect(m.isFolderOpen("/b")).toBe(true);
  });

  it("ignores saved values that aren't a list of paths", () => {
    localStorage.setItem("file-tree-open", '{"x":1}');
    expect(m.isFolderOpen("x")).toBe(false);
  });

  it("starts empty when storage holds bad JSON", () => {
    localStorage.setItem("file-tree-open", "{");
    expect(m.isFolderOpen("/a")).toBe(false);
  });

  it("keeps working when storage throws on write", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    m.setFolderOpen("/a", true);
    expect(m.isFolderOpen("/a")).toBe(true);
    vi.restoreAllMocks();
  });
});
