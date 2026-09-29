// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listFiles } from "./fileIndex.ts";

let dir: string;
const write = (path: string) => {
  mkdirSync(join(dir, path, ".."), { recursive: true });
  writeFileSync(join(dir, path), "");
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "files-"));
  for (const f of ["src/a.ts", "node_modules/dep/i.js", ".hidden/x", "b.md"]) {
    write(f);
  }
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("listFiles", () => {
  it("walks a folder outside git, skipping dot and dependency folders", async () => {
    expect((await listFiles(dir)).sort()).toEqual(["b.md", "src/a.ts"]);
  });

  it("lists what git sees in a repository, ignored files left out", async () => {
    execFileSync("git", ["init", "-q"], { cwd: dir });
    writeFileSync(join(dir, ".gitignore"), "node_modules/\n");
    expect((await listFiles(dir)).sort()).toEqual([
      ".gitignore",
      ".hidden/x",
      "b.md",
      "src/a.ts",
    ]);
  });

  it("lists a repository inside a plain folder as its git sees it", async () => {
    write("app/src/b.ts");
    write("app/ios/Pods/x.hpp");
    const app = join(dir, "app");
    execFileSync("git", ["init", "-q"], { cwd: app });
    writeFileSync(join(app, ".gitignore"), "/ios\n");
    expect((await listFiles(dir)).sort()).toEqual([
      "app/.gitignore",
      "app/src/b.ts",
      "b.md",
      "src/a.ts",
    ]);
  });
});
