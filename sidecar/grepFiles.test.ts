// @vitest-environment node
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { expect, it } from "vitest";
import { fileCounts, registerGrep } from "./grepFiles.ts";

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
