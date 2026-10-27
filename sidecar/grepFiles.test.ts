// @vitest-environment node
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { expect, it } from "vitest";
import { fileCounts, registerGrep, searchGlob } from "./grepFiles.ts";

const cwd = mkdtempSync(join(tmpdir(), "grep-ext-"));
writeFileSync(join(cwd, "a.ts"), "needle\nneedle\nhay\n");
writeFileSync(join(cwd, "b.ts"), "hay\nneedle\n");

function load() {
  let tool: ToolDefinition | undefined;
  registerGrep({ registerTool: (t: ToolDefinition) => (tool = t) } as never);
  return (params: object) =>
    tool!.execute("call", params as never, undefined, undefined, {
      cwd,
    } as never);
}

const text = (r: { content: unknown[] }) =>
  (r.content[0] as { text: string }).text;

it("lists the matching files with counts, most first", async () => {
  const run = load();
  expect(text(await run({ pattern: "needle", filesOnly: true }))).toBe(
    "2 files:\na.ts (2)\nb.ts (1)",
  );
});

it("still returns the matching lines without filesOnly", async () => {
  const run = load();
  expect(text(await run({ pattern: "needle", glob: "b.ts" }))).toBe(
    "b.ts:2: needle",
  );
});

it("passes no matches through, and says when the list is cut short", () => {
  expect(fileCounts("No matches found", false)).toBe("No matches found");
  expect(fileCounts("a.ts:1: x", true)).toContain("narrow the pattern");
});

it("finds a pattern that spans lines, which ripgrep alone refuses", async () => {
  const run = load();
  writeFileSync(
    join(cwd, "c.ts"),
    "function go(\n  x: number,\n) {}\nfunction go(y) {}\n",
  );
  expect(
    text(await run({ pattern: "function go\\(\\n\\s*x", glob: "c.ts" })),
  ).toBe("c.ts:1: function go(\nc.ts-2:   x: number,");
  expect(
    text(await run({ pattern: "go(\n  x", literal: true, glob: "c.ts" })),
  ).toBe("c.ts:1: function go(\nc.ts-2:   x: number,");
  expect(
    text(await run({ pattern: "function go\\(\\nnever", glob: "c.ts" })),
  ).toBe("No matches found");
});

it("searches a single file across lines too", async () => {
  const run = load();
  expect(text(await run({ pattern: "hay\\nneedle", path: "b.ts" }))).toBe(
    "b.ts:1: hay\nb.ts-2: needle",
  );
});

it("finds files by a glob naming their folder, which ripgrep alone matches against its own working directory", async () => {
  const run = load();
  mkdirSync(join(cwd, "lib"), { recursive: true });
  writeFileSync(join(cwd, "lib", "models.ts"), "gallery: 'nano'\n");
  expect(text(await run({ pattern: "gallery", glob: "lib/models.ts" }))).toBe(
    "lib/models.ts:1: gallery: 'nano'",
  );
  expect(
    text(await run({ pattern: "gallery", glob: "{lib/models.ts,x/y.ts}" })),
  ).toBe("lib/models.ts:1: gallery: 'nano'");
});

it("leads a folder glob with **/ only when it needs it, keeping an exclusion's !", () => {
  expect(searchGlob("lib/models.ts")).toBe("**/lib/models.ts");
  expect(searchGlob("././lib/*.ts")).toBe("**/lib/*.ts");
  expect(searchGlob("/src/index.ts")).toBe("**/src/index.ts");
  expect(searchGlob("**/lib/*.ts")).toBe("**/lib/*.ts");
  expect(searchGlob("../shared/*.ts")).toBe("../shared/*.ts");
  expect(searchGlob("*.ts")).toBe("*.ts");
  expect(searchGlob("!dist/bundle.js")).toBe("!**/dist/bundle.js");
  expect(searchGlob("!*.min.js")).toBe("!*.min.js");
});

it("still excludes by a folder glob", async () => {
  const run = load();
  mkdirSync(join(cwd, "dist"), { recursive: true });
  writeFileSync(join(cwd, "dist", "bundle.ts"), "needle\n");
  const found = text(
    await run({ pattern: "needle", glob: "!dist/bundle.ts", filesOnly: true }),
  );
  expect(found).toContain("a.ts");
  expect(found).not.toContain("dist/bundle.ts");
});
