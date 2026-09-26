import { beforeEach, describe, expect, it, vi } from "vitest";
import { entry, fakeFs } from "@/test/fakeFs";

// gitignore.ts caches rules and repo roots per module instance; load a fresh
// copy per test so one test's fake filesystem never leaks into the next.
let withoutGitIgnored: typeof import("./gitignore").withoutGitIgnored;
beforeEach(async () => {
  vi.resetModules();
  ({ withoutGitIgnored } = await import("./gitignore"));
});

const names = (entries: { name: string }[]) => entries.map((e) => e.name);

describe("withoutGitIgnored", () => {
  it("returns entries untouched outside a Git repository", async () => {
    fakeFs({ "/plain/dist/x": "", "/plain/.gitignore": "dist/" });
    const entries = [entry("dist", true), entry("a.ts")];
    expect(await withoutGitIgnored("/plain", entries)).toEqual(entries);
  });

  it("returns entries untouched in a repo without any .gitignore", async () => {
    fakeFs({ "/repo/.git": null, "/repo/a.ts": "" });
    const entries = [entry("a.ts")];
    expect(await withoutGitIgnored("/repo", entries)).toEqual(entries);
  });

  it("hides entries matched by the root .gitignore", async () => {
    fakeFs({ "/repo/.git": null, "/repo/.gitignore": "dist\n*.log\n" });
    const result = await withoutGitIgnored("/repo", [
      entry("dist", true),
      entry("debug.log"),
      entry("src", true),
    ]);
    expect(names(result)).toEqual(["src"]);
  });

  it("applies directory-only patterns to directories but not files", async () => {
    fakeFs({ "/repo/.git": null, "/repo/.gitignore": "build/\n" });
    const result = await withoutGitIgnored("/repo", [
      entry("build", true),
      entry("build"),
    ]);
    expect(result).toEqual([entry("build")]);
  });

  it("applies the root rules inside subdirectories", async () => {
    fakeFs({ "/repo/.git": null, "/repo/.gitignore": "*.log\n" });
    const result = await withoutGitIgnored("/repo/src/deep", [
      entry("trace.log"),
      entry("main.ts"),
    ]);
    expect(names(result)).toEqual(["main.ts"]);
  });

  it("applies a nested .gitignore relative to its own directory", async () => {
    fakeFs({
      "/repo/.git": null,
      "/repo/pkg/.gitignore": "generated/\n",
    });
    const result = await withoutGitIgnored("/repo/pkg", [
      entry("generated", true),
      entry("index.ts"),
    ]);
    expect(names(result)).toEqual(["index.ts"]);
  });

  it("lets a nested .gitignore re-include what a parent ignored", async () => {
    fakeFs({
      "/repo/.git": null,
      "/repo/.gitignore": "*.log\n",
      "/repo/logs/.gitignore": "!keep.log\n",
    });
    const result = await withoutGitIgnored("/repo/logs", [
      entry("keep.log"),
      entry("drop.log"),
    ]);
    expect(names(result)).toEqual(["keep.log"]);
  });

  it("finds the repo root by walking up from a nested directory", async () => {
    fakeFs({ "/work/repo/.git": null, "/work/repo/.gitignore": "tmp\n" });
    const result = await withoutGitIgnored("/work/repo/a/b", [entry("tmp")]);
    expect(result).toEqual([]);
  });

  it("reads each .gitignore once and caches it", async () => {
    const { calls } = fakeFs({
      "/repo/.git": null,
      "/repo/.gitignore": "dist\n",
    });
    await withoutGitIgnored("/repo", [entry("dist", true)]);
    await withoutGitIgnored("/repo", [entry("dist", true)]);
    const reads = calls.filter((c) => c === "plugin:fs|read_text_file");
    expect(reads).toHaveLength(1);
  });
});
