// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, expect, it } from "vitest";
import { memory } from "./testMemory.ts";
import { addMemories, memoryDb } from "./memoryDb.ts";
import { applyOutcome, type Entry, type Group } from "./memoryGroups.ts";
import { byIds, recent } from "./memorySearch.ts";

let dir: string;
let db: DatabaseSync;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "memory-apply-"));
  db = memoryDb(join(dir, "memory.db"));
  addMemories(db, [
    memory({ title: "a", createdAt: 10 }),
    memory({ title: "b", createdAt: 20 }),
    memory({ title: "c", createdAt: 30 }),
    memory({ title: "lt", createdAt: 15, concepts: ["consolidated"] }),
  ]);
});
afterEach(async () => {
  db.close();
  await rm(dir, { recursive: true, force: true });
});

const FOLDER = "/work/app";
const group = (): Group => {
  const [a, b, c, lt] = byIds(db, FOLDER, [1, 2, 3, 4]);
  return { key: "src/a.ts", raw: [a, b, c], longTerm: [lt], newest: 3 };
};
const entry = (sources: number[], over: Partial<Entry> = {}): Entry => ({
  ...memory({ title: "merged", concepts: ["consolidated"], createdAt: 30 }),
  sources,
  ...over,
});
const pass = () =>
  db.prepare("SELECT * FROM consolidations WHERE folder = ?").all(FOLDER);

it("adds the entries, retires their sources and the stale, and records the pass", () => {
  applyOutcome(
    db,
    FOLDER,
    group(),
    { entries: [entry([1, 2])], stale: [{ id: 3, reason: "gone" }] },
    500,
  );
  const [a, b, c] = byIds(db, FOLDER, [1, 2, 3]);
  expect(a).toMatchObject({
    retiredAt: 500,
    supersededBy: 5,
    retiredReason: "merged into memory 5",
  });
  expect(b.supersededBy).toBe(5);
  expect(c).toMatchObject({ retiredAt: 500, retiredReason: "gone" });
  expect(c).not.toHaveProperty("supersededBy");
  expect(recent(db, FOLDER, 9).map((m) => m.title)).toEqual(["merged", "lt"]);
  expect(pass()).toEqual([
    { folder: FOLDER, key: "src/a.ts", last_id: 3, at: 500 },
  ]);
});

it("records the highest raw id, not the long-term members', and updates it", () => {
  const g = group();
  applyOutcome(
    db,
    FOLDER,
    { ...g, raw: [g.raw[0]] },
    { entries: [], stale: [] },
    1,
  );
  expect(pass()).toEqual([
    { folder: FOLDER, key: "src/a.ts", last_id: 1, at: 1 },
  ]);
  applyOutcome(db, FOLDER, g, { entries: [], stale: [] }, 2);
  expect(pass()).toEqual([
    { folder: FOLDER, key: "src/a.ts", last_id: 3, at: 2 },
  ]);
});

it("keeps the reason of a memory already retired", () => {
  applyOutcome(
    db,
    FOLDER,
    group(),
    { entries: [], stale: [{ id: 1, reason: "first" }] },
    1,
  );
  applyOutcome(
    db,
    FOLDER,
    group(),
    { entries: [entry([1])], stale: [{ id: 1, reason: "second" }] },
    2,
  );
  expect(byIds(db, FOLDER, [1])[0]).toMatchObject({
    retiredAt: 1,
    retiredReason: "first",
  });
});

it("writes nothing when one write fails", () => {
  const broken = entry([2], { title: null as unknown as string });
  expect(() =>
    applyOutcome(
      db,
      FOLDER,
      group(),
      { entries: [entry([1]), broken], stale: [{ id: 3, reason: "x" }] },
      500,
    ),
  ).toThrow();
  expect(byIds(db, FOLDER, [1, 2, 3]).some((m) => m.retiredAt)).toBe(false);
  expect(recent(db, FOLDER, 9)).toHaveLength(4);
  expect(pass()).toEqual([]);
});

it("writes nothing when another pass already took the group", () => {
  db.prepare(
    "INSERT INTO consolidations (folder, key, last_id, at) VALUES (?, ?, 3, 1)",
  ).run(FOLDER, "src/a.ts");
  expect(
    applyOutcome(db, FOLDER, group(), { entries: [entry([1])], stale: [] }),
  ).toBe(false);
  expect(recent(db, FOLDER, 10)).toHaveLength(4);
});

it("drops an entry one of whose sources was removed meanwhile", () => {
  const g = group();
  db.prepare("DELETE FROM memories WHERE id = 2").run();
  expect(
    applyOutcome(db, FOLDER, g, { entries: [entry([1, 2])], stale: [] }),
  ).toBe(true);
  expect(recent(db, FOLDER, 10).map((m) => m.title)).toEqual(["c", "lt", "a"]);
});
