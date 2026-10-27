// @vitest-environment node
import { mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { inContext, retries } from "./grepContext.ts";

const dir = realpathSync(mkdtempSync(join(tmpdir(), "grep-context-")));
writeFileSync(
  join(dir, "route.ts"),
  [
    "export function route(text: string) {", // 1
    "  const found = cheapest(text);", // 2
    "  return found;", // 3
    "}", // 4
    "", // 5
    "export function other() {", // 6
    "  return cheapest('x');", // 7
    "}", // 8
    "const top = cheapest('y');", // 9
  ].join("\n"),
);
writeFileSync(join(dir, "notes.md"), "cheapest model\n");
const long = Array.from({ length: 70 }, (_, i) => `  cheapest(${i});`);
writeFileSync(
  join(dir, "long.ts"),
  ["function big() {", ...long, "}"].join("\n"),
);

it("names the definition holding each hit, and shows its code when the hits are few", async () => {
  const out = await inContext(
    "route.ts:2:   const found = cheapest(text);",
    dir,
  );
  expect(out).toContain(
    "route.ts:2:   const found = cheapest(text);  [in route, lines 1-4]",
  );
  expect(out).toContain("[The code holding these hits:]");
  expect(out).toContain(
    "route.ts (route, lines 1-4):\n1\texport function route",
  );
  expect(out).toContain("4\t}");
});

it("labels without code past 3 hits, a hit outside every definition, or a long definition", async () => {
  const many = [
    "route.ts:2:   const found = cheapest(text);",
    "route.ts:7:   return cheapest('x');",
    "route.ts:9: const top = cheapest('y');",
    "notes.md:1: cheapest model",
  ].join("\n");
  const out = await inContext(many, dir);
  expect(out).toContain("[in other, lines 6-8]");
  expect(out).toContain("route.ts:9: const top = cheapest('y');\n");
  expect(out).toContain("notes.md:1: cheapest model");
  expect(out).not.toContain("[The code holding");
  const big = await inContext("long.ts:5:   cheapest(3);", dir);
  expect(big).toContain("[in big, lines 1-72]");
  expect(big).not.toContain("[The code holding");
});

it("reads a single searched file by its path, and leaves other output alone", async () => {
  const out = await inContext(
    "route.ts:7:   return cheapest('x');",
    dir,
    "route.ts",
  );
  expect(out).toContain("[in other, lines 6-8]");
  expect(await inContext("No matches found", dir)).toBe("No matches found");
});

it("tries an empty search ignoring case, then outside the glob it was typed with", () => {
  expect(
    retries({ pattern: "Route", glob: "**/lib/*.ts" }, "lib/*.ts"),
  ).toEqual([
    {
      input: { pattern: "Route", glob: "**/lib/*.ts", ignoreCase: true },
      note: "No matches found. Ignoring case, it appears in:",
      files: true,
    },
    {
      input: { pattern: "Route", glob: undefined },
      note: "No matches found in files matching lib/*.ts. In other files:",
    },
  ]);
  expect(retries({ pattern: "Route", ignoreCase: true })).toEqual([]);
});

it("never drops an excluding glob, nor retries case for letters only in escapes", () => {
  expect(retries({ pattern: "\\d{4}-\\s", glob: "!dist/**" })).toEqual([]);
});

it("skips context lines that look like hits, and shows CRLF code without \\r", async () => {
  writeFileSync(join(dir, "crlf.ts"), "function crlf() {\r\n  hit();\r\n}\r\n");
  const out = await inContext(
    "crlf.ts:2:   hit();\nnotes.md-3- at 10:30: standup",
    dir,
  );
  expect(out).toContain("[in crlf, lines 1-3]");
  expect(out).toContain("notes.md-3- at 10:30: standup\n");
  expect(out).toContain("1\tfunction crlf() {\n2\t  hit();");
  expect(out).not.toContain("\r");
});

it("reads the searched path as pi does, and leaves out a file too big to parse", async () => {
  const at = await inContext(
    "route.ts:7:   return cheapest('x');",
    dir,
    `@${dir}`,
  );
  expect(at).toContain("[in other, lines 6-8]");
  writeFileSync(
    join(dir, "huge.ts"),
    `function huge() {\n${" ".repeat(600_000)}\n}`,
  );
  expect(await inContext("huge.ts:2: x", dir)).toBe("huge.ts:2: x");
});
