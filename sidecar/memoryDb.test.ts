// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, expect, it } from "vitest";
import { memory } from "./testMemory.ts";
import { addMemory, memoryDb } from "./memoryDb.ts";
import { byIds } from "./memorySearch.ts";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "memory-db-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

it("adds a memory and returns its id, null for an origin already imported", () => {
  const db = memoryDb(join(dir, "memory.db"));
  const first = addMemory(db, memory({ origin: "cmem:o:1" }));
  expect(first).toEqual(expect.any(Number));
  expect(addMemory(db, memory({ origin: "cmem:o:1" }))).toBeNull();
  expect(addMemory(db, memory())).toBe(first! + 1);
  expect(addMemory(db, memory())).toBe(first! + 2);
  db.close();
});

it("reads a retired memory's replacement and reason, none on others", () => {
  const db = memoryDb(join(dir, "memory.db"));
  const a = addMemory(db, memory({ title: "a" }))!;
  const b = addMemory(db, memory({ title: "b" }))!;
  const c = addMemory(db, memory({ title: "c" }))!;
  const retire = db.prepare(
    "UPDATE memories SET retired_at = ?, superseded_by = ?, retired_reason = ? WHERE id = ?",
  );
  retire.run(5, c, "merged", a);
  retire.run(6, null, null, b);
  const [ra, rb, rc] = byIds(db, "/work/app", [a, b, c]);
  expect(ra).toMatchObject({
    retiredAt: 5,
    supersededBy: c,
    retiredReason: "merged",
  });
  expect(rb.retiredAt).toBe(6);
  expect(rb).not.toHaveProperty("supersededBy");
  expect(rb).not.toHaveProperty("retiredReason");
  expect(rc).not.toHaveProperty("retiredAt");
  db.close();
});

it("adds the retired columns to a database from before them, keeping its memories", () => {
  const file = join(dir, "old.db");
  const old = new DatabaseSync(file);
  old.exec(`CREATE TABLE memories (
    id INTEGER PRIMARY KEY, folder TEXT NOT NULL, conversation TEXT,
    platform TEXT NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL,
    subtitle TEXT, facts TEXT NOT NULL, narrative TEXT, concepts TEXT NOT NULL,
    files_read TEXT NOT NULL, files_modified TEXT NOT NULL,
    created_at INTEGER NOT NULL, origin TEXT UNIQUE);
    INSERT INTO memories (folder, platform, type, title, facts, concepts, files_read, files_modified, created_at)
    VALUES ('/work/app', 'ignite', 'bugfix', 'Old', '[]', '[]', '[]', '[]', 1)`);
  old.close();
  const db = memoryDb(file);
  const [kept] = byIds(db, "/work/app", [1]);
  expect(kept.title).toBe("Old");
  const id = addMemory(db, memory())!;
  db.prepare("UPDATE memories SET retired_at = 9 WHERE id = ?").run(id);
  expect(byIds(db, "/work/app", [id])[0].retiredAt).toBe(9);
  expect(db.prepare("SELECT count(*) AS n FROM consolidations").get()).toEqual({
    n: 0,
  });
  db.close();
});
