// @vitest-environment node
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { outline, outlines } from "./outline.ts";

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
