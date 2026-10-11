// @vitest-environment node
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { expect, it } from "vitest";
import { registerOutline, registerRead, WINDOW } from "./readTools.ts";

const cwd = mkdtempSync(join(tmpdir(), "read-tools-"));
const lines = (n: number) =>
  Array.from({ length: n }, (_, i) => `const v${i + 1} = ${i + 1};`).join("\n");
writeFileSync(join(cwd, "long.ts"), lines(WINDOW + 50));
writeFileSync(join(cwd, "long.txt"), lines(WINDOW + 50));
writeFileSync(join(cwd, "short.ts"), "function f() {}\n");

function load(register: (pi: never) => void) {
  let tool: ToolDefinition | undefined;
  register({ registerTool: (t: ToolDefinition) => (tool = t) } as never);
  return async (params: object) => {
    const r = await tool!.execute(
      "call",
      params as never,
      undefined,
      undefined,
      {
        cwd,
      } as never,
    );
    return (r.content[0] as { text: string }).text;
  };
}

it("shows a window of a long file, pointing a code file at outline", async () => {
  const read = load(registerRead);
  const code = await read({ path: "long.ts" });
  expect(code).toContain(`${WINDOW}\tconst v${WINDOW} = ${WINDOW};`);
  expect(code).not.toContain(`const v${WINDOW + 1} =`);
  expect(code).toContain(`50 more lines in file. Use offset=${WINDOW + 1}`);
  expect(code).toMatch(/Or outline it/);
  expect(await read({ path: "long.txt" })).not.toMatch(/outline/);
});

it("windows a read that only names an offset", async () => {
  const read = load(registerRead);
  writeFileSync(join(cwd, "longer.ts"), lines(WINDOW * 2 + 10));
  const page = await read({ path: "longer.ts", offset: WINDOW + 1 });
  expect(page).toContain(`${WINDOW * 2}\tconst v${WINDOW * 2} =`);
  expect(page).not.toContain(`const v${WINDOW * 2 + 1} =`);
  expect(page).toMatch(/Or outline it/);
});

it("leaves an explicit range and a short file as they are", async () => {
  const read = load(registerRead);
  const ranged = await read({ path: "long.ts", offset: 1, limit: 2 });
  expect(ranged).not.toMatch(/outline/);
  expect(await read({ path: "short.ts" })).toBe("1\tfunction f() {}\n");
});

it("outlines a file relative to the folder", async () => {
  const run = load(registerOutline);
  expect(await run({ path: "short.ts" })).toBe("1: function f() {}");
});

it("reads a definition by name, and several parts in one call", async () => {
  const read = load(registerRead);
  writeFileSync(
    join(cwd, "box.ts"),
    "const a = 1;\nfunction open() {\n  return a;\n}\n",
  );
  expect(await read({ path: "box.ts", symbol: "open" })).toBe(
    "--- box.ts open (lines 2-4) ---\n2\tfunction open() {\n3\t  return a;\n4\t}",
  );
  const both = await read({
    path: "short.ts",
    also: [{ path: "long.ts", offset: 2, limit: 1 }],
  });
  expect(both).toMatch(/^--- short\.ts ---\n1\tfunction f\(\) \{\}/);
  expect(both).toContain("--- long.ts ---\n2\tconst v2 = 2;");
});

it("says why one part failed and still reads the rest; throws when all fail", async () => {
  const read = load(registerRead);
  const text = await read({
    path: "short.ts",
    also: [{ path: "box.ts", symbol: "close" }],
  });
  expect(text).toContain("1\tfunction f() {}");
  expect(text).toContain("No definition named close in box.ts");
  await expect(read({ path: "short.ts", symbol: "nope" })).rejects.toThrow(
    "No definition named nope",
  );
});

it("outlines a folder when given one", async () => {
  const run = load(registerOutline);
  expect(await run({ path: "." })).toContain("short.ts\n  1: function f() {}");
});
