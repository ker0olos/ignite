// @vitest-environment node
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { outline, outlineFolder, outlines, symbolLines } from "./outline.ts";

const dir = mkdtempSync(join(tmpdir(), "outline-"));
const file = (name: string, text: string) => {
  writeFileSync(join(dir, name), text);
  return join(dir, name);
};

it("lists a TypeScript file's definitions by line, nested ones indented", async () => {
  const path = file(
    "a.ts",
    [
      "export function top(a: number) {",
      "  return a;",
      "}",
      "",
      "export class Box {",
      "  open(lid: string) {",
      "    return lid;",
      "  }",
      "}",
      "interface Shape { sides: number }",
    ].join("\n"),
  );
  expect(await outline(path)).toBe(
    [
      "1: export function top(a: number) {",
      "5: export class Box {",
      "6:   open(lid: string) {",
      "10: interface Shape { sides: number }",
    ].join("\n"),
  );
});

it("finds a definition's lines by name, or by the one holding it", async () => {
  const path = file(
    "e.ts",
    [
      "class Box {",
      "  open() {",
      "    return 1;",
      "  }",
      "}",
      "class Jar {",
      "  open() {}",
      "}",
    ].join("\n"),
  );
  expect(await symbolLines(path, "open")).toEqual([
    { start: 2, end: 4 },
    { start: 7, end: 7 },
  ]);
  expect(await symbolLines(path, "Jar.open")).toEqual([{ start: 7, end: 7 }]);
  expect(await symbolLines(path, "Box")).toEqual([{ start: 1, end: 5 }]);
  expect(await symbolLines(path, "close")).toEqual([]);
});

it("reads Python and says when a file defines nothing", async () => {
  expect(await outline(file("b.py", "def go():\n    pass\n"))).toBe(
    "1: def go():",
  );
  expect(await outline(file("c.js", "console.log(1);\n"))).toBe(
    "No definitions found; read it instead.",
  );
});

it("refuses files it has no grammar for", async () => {
  expect(outlines("notes.md")).toBe(false);
  expect(outlines("App.TSX")).toBe(true);
  await expect(outline(file("d.md", "# hi"))).rejects.toThrow(
    "No outline for .md files",
  );
});

it("outlines a folder's code files with their top-level definitions", async () => {
  const folder = mkdtempSync(join(tmpdir(), "outline-folder-"));
  mkdirSync(join(folder, "lib"));
  writeFileSync(join(folder, "lib/b.ts"), "class Box {\n  open() {}\n}\n");
  writeFileSync(join(folder, "a.py"), "def go():\n    pass\n");
  writeFileSync(join(folder, "notes.md"), "# hi");
  writeFileSync(join(folder, "a.test.ts"), "function t() {}\n");
  writeFileSync(join(folder, "x_test.go"), "package x\n");
  mkdirSync(join(folder, "tests"));
  writeFileSync(join(folder, "tests/test_y.py"), "def t():\n    pass\n");
  symlinkSync("/etc/hosts", join(folder, "link.ts"));
  expect(await outlineFolder(folder)).toBe(
    ["a.py", "  1: def go():", "lib/b.ts", "  1: class Box {"].join("\n"),
  );
  const empty = mkdtempSync(join(tmpdir(), "outline-empty-"));
  expect(await outlineFolder(empty)).toMatch(/^No code files here/);
});

it("says how many code files a big folder leaves out", async () => {
  const folder = mkdtempSync(join(tmpdir(), "outline-big-"));
  for (let i = 0; i < 82; i++) writeFileSync(join(folder, `f${i}.ts`), "");
  expect(await outlineFolder(folder)).toMatch(
    /\n\[2 more code files; outline a folder inside this one\.\]$/,
  );
});

it("stops a folder at whole files once its text gets long", async () => {
  const folder = mkdtempSync(join(tmpdir(), "outline-long-"));
  const fns = Array.from({ length: 400 }, (_, i) => `function f${i}() {}`);
  for (let i = 0; i < 5; i++) {
    writeFileSync(join(folder, `g${i}.ts`), fns.join("\n"));
  }
  const text = await outlineFolder(folder);
  expect(text.length).toBeLessThan(30_000 + 100);
  expect(text).toMatch(
    /\n\[\d more code files; outline a folder inside this one\.\]$/,
  );
});
