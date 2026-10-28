// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { memory } from "./testMemory.ts";
import { addMemories, memoryDb, type NewMemory } from "./memoryDb.ts";
import {
  around,
  byIds,
  count,
  counts,
  latestOf,
  longTerm,
  recent,
  search,
  withConcept,
} from "./memorySearch.ts";

let dir: string;
let db: DatabaseSync;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "memory-"));
  db = memoryDb(join(dir, "memory.db"));
});
afterEach(async () => {
  db.close();
  await rm(dir, { recursive: true, force: true });
});

const titles = (list: { title: string }[]) => list.map((m) => m.title);

describe("addMemories", () => {
  it("adds memories and reads them back as they were", () => {
    const m = memory({
      title: "Fixed the timer",
      facts: ["It started at 04:59"],
      concepts: ["gotcha"],
      filesModified: ["src/timer.ts"],
    });
    expect(addMemories(db, [m])).toBe(1);
    const [read] = recent(db, "/work/app", 1);
    expect(read).toEqual({ ...m, id: read.id });
  });

  it("adds an imported memory once", () => {
    const m = memory({ origin: "cmem:o:1" });
    expect(addMemories(db, [m, m])).toBe(1);
    expect(addMemories(db, [m])).toBe(0);
    expect(count(db, "/work/app")).toBe(1);
  });

  it("adds none when one fails", () => {
    const broken = { ...memory(), title: null } as unknown as NewMemory;
    expect(() => addMemories(db, [memory(), broken])).toThrow();
    expect(count(db, "/work/app")).toBe(0);
  });

  it("opens one connection per file", () => {
    expect(memoryDb(join(dir, "memory.db"))).toBe(db);
  });
});

it("lists a folder's newest observations or summaries", () => {
  addMemories(db, [
    memory({ title: "old", createdAt: 1 }),
    memory({ title: "new", createdAt: 2 }),
    memory({ title: "gist", type: "summary", createdAt: 3 }),
    memory({ title: "elsewhere", folder: "/work/other", createdAt: 4 }),
  ]);
  expect(titles(recent(db, "/work/app", 5))).toEqual(["new", "old"]);
  expect(titles(recent(db, "/work/app", 1))).toEqual(["new"]);
  expect(titles(recent(db, "/work/app", 5, true))).toEqual(["gist"]);
  expect(count(db, "/work/app")).toBe(2);
});

describe("search", () => {
  beforeEach(() => {
    addMemories(db, [
      memory({ title: "Worktrees are cleaned up on close", createdAt: 1 }),
      memory({
        title: "Sidebar glass",
        narrative: "The worktree list moved",
        type: "feature",
        createdAt: 2,
      }),
      memory({ title: "Cleanup of caches", createdAt: 3 }),
      memory({ title: "Worktree elsewhere", folder: "/work/other" }),
    ]);
  });

  it("finds memories with every word, by stem and prefix, in the folder only", () => {
    expect(
      titles(search(db, "/work/app", "worktree clean", { limit: 9 })),
    ).toEqual(["Worktrees are cleaned up on close"]);
    expect(
      titles(search(db, "/work/app", "worktr", { limit: 9 })),
    ).toHaveLength(2);
  });

  it("finds memories with any word when none has them all", () => {
    expect(
      titles(search(db, "/work/app", "glass cleanup", { limit: 9 })),
    ).toEqual(expect.arrayContaining(["Sidebar glass", "Cleanup of caches"]));
  });

  it("filters by type and date, and limits", () => {
    const find = (filter: object) =>
      titles(search(db, "/work/app", "worktree", { limit: 9, ...filter }));
    expect(find({ types: ["feature"] })).toEqual(["Sidebar glass"]);
    expect(find({ since: 2 })).toEqual(["Sidebar glass"]);
    expect(find({ limit: 1 })).toHaveLength(1);
  });

  it("reads FTS syntax as words", () => {
    expect(search(db, "/work/app", 'close" OR "x', { limit: 9 })).toHaveLength(
      1,
    );
    expect(search(db, "/work/app", "  -- ", { limit: 9 })).toEqual([]);
  });
});

it("reads memories by id, in the order asked", () => {
  addMemories(db, [memory({ title: "a" }), memory({ title: "b" })]);
  const [a, b] = recent(db, "/work/app", 2).reverse();
  addMemories(db, [memory({ title: "x", folder: "/work/other" })]);
  const [other] = recent(db, "/work/other", 1);
  expect(titles(byIds(db, "/work/app", [b.id, 999, other.id, a.id]))).toEqual([
    "b",
    "a",
  ]);
  expect(byIds(db, "/work/app", [])).toEqual([]);
});

it("reads the memories around one, in its folder", () => {
  addMemories(
    db,
    ["a", "b", "c", "d", "e"].map((title, i) =>
      memory({ title, createdAt: i % 2 }),
    ),
  );
  addMemories(db, [memory({ title: "x", folder: "/work/other" })]);
  const ids = byIds(db, "/work/app", [1, 2, 3, 4, 5]).map((m) => m.id);
  // By time, then id: a c e (time 0), b d (time 1).
  expect(titles(around(db, "/work/app", ids[4], 1, 2))).toEqual([
    "c",
    "e",
    "b",
    "d",
  ]);
  expect(titles(around(db, "/work/app", ids[0], 3, 0))).toEqual(["a"]);
  expect(around(db, "/work/app", 999, 1, 1)).toEqual([]);
  expect(around(db, "/work/other", ids[0], 1, 1)).toEqual([]);
});

describe("retired memories", () => {
  const retire = (title: string) =>
    db.prepare("UPDATE memories SET retired_at = 9 WHERE title = ?").run(title);

  beforeEach(() => {
    addMemories(db, [
      memory({ title: "a old", concepts: ["gotcha"], createdAt: 1 }),
      memory({ title: "b old", type: "decision", createdAt: 2 }),
      memory({ title: "c live", concepts: ["gotcha"], createdAt: 3 }),
      memory({ title: "d old", createdAt: 4 }),
      memory({ title: "e live", type: "decision", createdAt: 5 }),
    ]);
    for (const t of ["a old", "b old", "d old"]) retire(t);
  });

  it("are left out of every list but byIds", () => {
    expect(titles(recent(db, "/work/app", 9))).toEqual(["e live", "c live"]);
    expect(count(db, "/work/app")).toBe(2);
    expect(counts(db, "/work/app")).toEqual({ discovery: 1, decision: 1 });
    expect(titles(search(db, "/work/app", "old live", { limit: 9 }))).toEqual(
      expect.arrayContaining(["c live", "e live"]),
    );
    expect(search(db, "/work/app", "old", { limit: 9 })).toEqual([]);
    expect(titles(withConcept(db, "/work/app", "gotcha", 9))).toEqual([
      "c live",
    ]);
    expect(titles(latestOf(db, "/work/app", "decision", 9))).toEqual([
      "e live",
    ]);
    expect(titles(byIds(db, "/work/app", [1, 2]))).toEqual(["a old", "b old"]);
  });

  it("are not the neighbours of a memory", () => {
    const [c] = search(db, "/work/app", "c live", { limit: 1 });
    expect(titles(around(db, "/work/app", c.id, 5, 5))).toEqual([
      "c live",
      "e live",
    ]);
  });
});

describe("long-term memories", () => {
  beforeEach(() => {
    addMemories(db, [
      memory({ title: "raw", createdAt: 1 }),
      memory({ title: "lt old", concepts: ["consolidated"], createdAt: 2 }),
      memory({
        title: "lt new",
        concepts: ["consolidated", "procedure"],
        createdAt: 3,
      }),
      memory({
        title: "lt gone",
        concepts: ["consolidated"],
        createdAt: 4,
      }),
    ]);
    db.prepare(
      "UPDATE memories SET retired_at = 9 WHERE title = 'lt gone'",
    ).run();
  });

  it("leave recent only when asked for the raw ones", () => {
    expect(titles(recent(db, "/work/app", 9))).toEqual([
      "lt new",
      "lt old",
      "raw",
    ]);
    expect(titles(recent(db, "/work/app", 9, false, "", true))).toEqual([
      "raw",
    ]);
  });

  it("list the folder's live ones, newest first, without a concept's", () => {
    expect(titles(longTerm(db, "/work/app", 9))).toEqual(["lt new", "lt old"]);
    expect(titles(longTerm(db, "/work/app", 1))).toEqual(["lt new"]);
    expect(titles(longTerm(db, "/work/app", 9, "procedure"))).toEqual([
      "lt old",
    ]);
    expect(longTerm(db, "/work/other", 9)).toEqual([]);
  });
});
