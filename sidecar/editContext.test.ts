// @vitest-environment node
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { expect, it } from "vitest";
import { changedLines, registerEdit } from "./editContext.ts";

const cwd = mkdtempSync(join(tmpdir(), "edit-context-"));
const lines = (n: number) =>
  Array.from({ length: n }, (_, i) => `line ${i + 1}`).join("\n");

async function edit(path: string, oldText: string, newText: string) {
  let tool: ToolDefinition | undefined;
  registerEdit({ registerTool: (t: ToolDefinition) => (tool = t) } as never);
  const r = await tool!.execute(
    "call",
    { path, edits: [{ oldText, newText }] } as never,
    undefined,
    undefined,
    { cwd } as never,
  );
  return (r.content[0] as { text: string }).text;
}

it("shows the edited lines as they now read, numbered", async () => {
  writeFileSync(join(cwd, "a.ts"), lines(20) + "\n");
  const text = await edit("a.ts", "line 10\n", "ten\nten and a half\n");
  expect(text).toBe(
    "Successfully replaced 1 block(s) in a.ts. Now:\n" +
      [6, 7, 8, 9].map((n) => `${n}\tline ${n}`).join("\n") +
      "\n10\tten\n11\tten and a half\n" +
      [11, 12, 13, 14].map((n) => `${n + 1}\tline ${n}`).join("\n"),
  );
});

it("drops CRLF's carriage returns and a BOM", async () => {
  writeFileSync(
    join(cwd, "b.ts"),
    "\uFEFF" + lines(40).replaceAll("\n", "\r\n"),
  );
  const text = await edit("b.ts", "line 2\n", "two\n");
  expect(text).toContain("1\tline 1\n2\ttwo\n");
  expect(text).not.toMatch(/\r|\uFEFF/);
});

it("works from the path pi resolved, the way pi's edit does", async () => {
  writeFileSync(join(cwd, "c.ts"), lines(3));
  expect(await edit("@c.ts", "line 2", "two")).toContain("2\ttwo");
});

const hunk = (start: number, n: number) =>
  `@@ -${start},${n} +${start},${n} @@\n` +
  Array.from({ length: n }, (_, i) => ` line ${start + i}`).join("\n");

it("numbers context and added lines, skips removed ones, separates hunks", () => {
  const patch = `--- a\n+++ b\n@@ -2,3 +2,3 @@\n line 2\n-old\n+new\n line 4\n\\ No newline at end of file\n${hunk(30, 1)}`;
  expect(changedLines(patch)).toBe(
    "2\tline 2\n3\tnew\n4\tline 4\n...\n30\tline 30",
  );
});

it("caps what it shows and says where more changes are", () => {
  expect(changedLines(`${hunk(1, 90)}\n${hunk(200, 3)}`)).toMatch(
    /\n80\tline 80\n\[More changes from line 81; read the file to see them\.\]$/,
  );
  expect(changedLines(`${hunk(1, 80)}\n${hunk(200, 3)}`)).toMatch(
    /\n80\tline 80\n\.\.\.\n\[More changes from line 200;/,
  );
});
