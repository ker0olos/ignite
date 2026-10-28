// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { memory } from "./testMemory.ts";
import { BUDGET, indexLines, recall } from "./memoryContext.ts";
import { addMemories, memoryDb, type Memory } from "./memoryDb.ts";

let dir: string;
let db: DatabaseSync;
beforeEach(async () => {
  vi.stubEnv("TZ", "UTC");
  dir = await mkdtemp(join(tmpdir(), "memory-context-"));
  db = memoryDb(join(dir, "memory.db"));
});
afterEach(async () => {
  vi.unstubAllEnvs();
  db.close();
  await rm(dir, { recursive: true, force: true });
});

const at = (iso: string) => Date.parse(iso);

it("lists memories oldest first by day, a repeated time as a ditto", () => {
  const list = [
    {
      ...memory({
        title: "Later",
        type: "bugfix",
        createdAt: at("2026-10-19T17:26:00Z"),
      }),
      id: 3,
    },
    {
      ...memory({
        title: "Same minute",
        type: "summary",
        createdAt: at("2026-10-19T17:26:30Z"),
      }),
      id: 4,
    },
    {
      ...memory({
        title: "First",
        type: "feature",
        createdAt: at("2026-10-18T09:05:00Z"),
      }),
      id: 1,
    },
    {
      ...memory({
        title: "Odd",
        type: "mine",
        createdAt: at("2026-10-19T08:00:00Z"),
      }),
      id: 2,
    },
  ] as Memory[];
  expect(indexLines(list)).toEqual([
    "",
    "### Oct 18, 2026",
    "1 9:05a ◆ First",
    "",
    "### Oct 19, 2026",
    "2 8:00a • Odd",
    "3 5:26p ● Later",
    '4 " 🎯 Same minute',
  ]);
});

it("recalls the folder's latest work with how to read it", () => {
  addMemories(db, [
    memory({ title: "Fixed the timer", type: "bugfix" }),
    memory({ title: "Elsewhere", folder: "/work/other" }),
  ]);
  const text = recall(db, "/work/app");
  expect(text).toMatch(/^# Memory: recent work in app\n/);
  expect(text).toContain("memory_get");
  expect(text).toContain("● Fixed the timer");
  expect(text).not.toContain("Elsewhere");
  expect(recall(db, "/work/empty")).toBe("");
});

it("lists fewer memories, summaries first, to stay in its budget", () => {
  const long = "x".repeat(400);
  addMemories(db, [
    ...Array.from({ length: 10 }, (_, i) =>
      memory({ title: `summary ${i} ${long}`, type: "summary", createdAt: i }),
    ),
    ...Array.from({ length: 30 }, (_, i) =>
      memory({ title: `obs ${i} ${long}`, createdAt: 100 + i }),
    ),
  ]);
  const text = recall(db, "/work/app");
  expect(text.length).toBeLessThanOrEqual(BUDGET);
  expect(text).not.toContain("summary ");
  expect(text).toContain("obs 29");
});

const longTerm = (title: string, createdAt: number, concepts: string[] = []) =>
  memory({ title, createdAt, concepts: ["consolidated", ...concepts] });

it("leads with the long-term memories, kept out of the recent ones", () => {
  addMemories(db, [
    longTerm("Merged timer", 1),
    memory({ title: "Fresh fix", createdAt: 2 }),
  ]);
  const text = recall(db, "/work/app");
  const at = (s: string) => text.indexOf(s);
  expect(at("## Long-term")).toBeGreaterThan(at("Legend:"));
  expect(at("Merged timer")).toBeGreaterThan(at("## Long-term"));
  expect(at("## Recent")).toBeGreaterThan(at("Merged timer"));
  expect(at("Fresh fix")).toBeGreaterThan(at("## Recent"));
  expect(text.match(/Merged timer/g)).toHaveLength(1);
});

it("recalls only long-term memories with no empty Recent heading", () => {
  addMemories(db, [longTerm("Merged", 1)]);
  const text = recall(db, "/work/app");
  expect(text).toMatch(/## Long-term[\s\S]*Merged$/);
  expect(text).not.toContain("## Recent");
});

it("has no long-term section without long-term memories, or when all are retired or left out", () => {
  addMemories(db, [
    memory({ title: "Fresh" }),
    longTerm("Gone", 1),
    longTerm("Procedure", 2, ["procedure"]),
  ]);
  db.prepare("UPDATE memories SET retired_at = 9 WHERE title = 'Gone'").run();
  expect(recall(db, "/work/app", "procedure")).not.toContain("## Long-term");
  expect(recall(db, "/work/app")).toContain("## Long-term");
});

it("keeps the newest long-term memories within their share of the budget", () => {
  const long = "x".repeat(400);
  addMemories(db, [
    ...Array.from({ length: 30 }, (_, i) => longTerm(`lt ${i} ${long}`, i)),
    ...Array.from({ length: 30 }, (_, i) =>
      memory({ title: `obs ${i} ${long}`, createdAt: 100 + i }),
    ),
  ]);
  const text = recall(db, "/work/app");
  const section = text.slice(
    text.indexOf("## Long-term"),
    text.indexOf("## Recent"),
  );
  expect(section.length).toBeLessThan(5_300);
  expect(section).toContain("lt 29");
  expect(section).not.toContain("lt 0 ");
  expect(text.length).toBeLessThanOrEqual(BUDGET);
  expect(text).toContain("obs 29");
});
