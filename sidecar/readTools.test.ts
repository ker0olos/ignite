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
  expect(code).toContain(`const v${WINDOW} = ${WINDOW};`);
  expect(code).not.toContain(`const v${WINDOW + 1} =`);
  expect(code).toContain(`50 more lines in file. Use offset=${WINDOW + 1}`);
  expect(code).toMatch(/Or outline it/);
  expect(await read({ path: "long.txt" })).not.toMatch(/outline/);
});

it("windows a read that only names an offset", async () => {
  const read = load(registerRead);
  writeFileSync(join(cwd, "longer.ts"), lines(WINDOW * 2 + 10));
  const page = await read({ path: "longer.ts", offset: WINDOW + 1 });
  expect(page).toContain(`const v${WINDOW * 2} =`);
  expect(page).not.toContain(`const v${WINDOW * 2 + 1} =`);
  expect(page).toMatch(/Or outline it/);
});

it("leaves an explicit range and a short file as they are", async () => {
  const read = load(registerRead);
  const ranged = await read({ path: "long.ts", offset: 1, limit: 2 });
  expect(ranged).not.toMatch(/outline/);
  expect(await read({ path: "short.ts" })).toBe("function f() {}\n");
});

it("outlines a file relative to the folder", async () => {
  const run = load(registerOutline);
  expect(await run({ path: "short.ts" })).toBe("1: function f() {}");
});
