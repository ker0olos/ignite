import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeFs } from "@/test/fakeFs";

// files.ts imports gitignore.ts, whose caches must not leak between tests.
let listDir: typeof import("./files").listDir;
let readForView: typeof import("./files").readForView;
let MAX_VIEW_BYTES: number;
beforeEach(async () => {
  vi.resetModules();
  ({ listDir, readForView, MAX_VIEW_BYTES } = await import("./files"));
});

describe("listDir", () => {
  const repo = {
    "/repo/.git": null,
    "/repo/.DS_Store": "",
    "/repo/.gitignore": "dist\n",
    "/repo/dist/out.js": "",
    "/repo/src/main.ts": "",
    "/repo/b.md": "",
    "/repo/A.md": "",
    "/repo/lib/x.ts": "",
  };

  it("always hides .git and .DS_Store", async () => {
    fakeFs(repo);
    const names = (await listDir("/repo", false)).map((e) => e.name);
    expect(names).not.toContain(".git");
    expect(names).not.toContain(".DS_Store");
  });

  it("puts folders first, each group sorted by name", async () => {
    fakeFs(repo);
    const names = (await listDir("/repo", false)).map((e) => e.name);
    expect(names).toEqual(["dist", "lib", "src", ".gitignore", "A.md", "b.md"]);
  });

  it("keeps Git-ignored entries when the setting is off", async () => {
    fakeFs(repo);
    const names = (await listDir("/repo", false)).map((e) => e.name);
    expect(names).toContain("dist");
  });

  it("hides Git-ignored entries when the setting is on", async () => {
    fakeFs(repo);
    const names = (await listDir("/repo", true)).map((e) => e.name);
    expect(names).not.toContain("dist");
  });

  it("rejects when the directory can't be read", async () => {
    fakeFs({});
    await expect(listDir("/missing", false)).rejects.toThrow();
  });
});

describe("readForView", () => {
  it("highlights a text file", async () => {
    fakeFs({ "/a.ts": "const x = 1;" });
    const result = await readForView("/a.ts");
    expect(result).toHaveProperty("html");
    expect("html" in result && result.html).toContain("shiki");
  });

  it("refuses files over the size limit", async () => {
    fakeFs({ "/big.txt": new Uint8Array(MAX_VIEW_BYTES + 1).fill(65) });
    expect(await readForView("/big.txt")).toEqual({
      message: "File is too large to show.",
    });
  });

  it("shows a file exactly at the size limit", async () => {
    fakeFs({ "/edge.txt": new Uint8Array(MAX_VIEW_BYTES).fill(65) });
    expect(await readForView("/edge.txt")).toHaveProperty("html");
  });

  it("refuses binary files", async () => {
    fakeFs({ "/img.png": new Uint8Array([0x89, 0x50, 0x00, 0x47]) });
    expect(await readForView("/img.png")).toEqual({
      message: "Binary file not shown.",
    });
  });

  it("turns read errors into a message instead of throwing", async () => {
    fakeFs({});
    expect(await readForView("/gone.ts")).toEqual({
      message: "Couldn't read this file.",
    });
  });
});
