// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { APP_NAME } from "../src/lib/app.ts";
import { memory } from "./testMemory.ts";
import { importOnStart, memoryEnabled, memoryStatus } from "./memory.ts";
import { addMemories, memoryDb } from "./memoryDb.ts";
import { count } from "./memorySearch.ts";

let dir: string;
let db: DatabaseSync;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "memory-status-"));
  vi.stubEnv("HOME", dir);
  db = memoryDb(join(dir, "memory.db"));
});
afterEach(async () => {
  vi.unstubAllEnvs();
  db.close();
  await rm(dir, { recursive: true, force: true });
});

const turnOff = async () => {
  await mkdir(join(dir, `.${APP_NAME}`), { recursive: true });
  await writeFile(
    join(dir, `.${APP_NAME}`, "settings.toml"),
    "[memory]\nenabled = false\n",
  );
};

it("is on unless the settings turn it off, in either key", async () => {
  const file = join(dir, "settings.toml");
  expect(await memoryEnabled(file)).toBe(true);
  await writeFile(file, "[memory]\nenabled = true\n");
  expect(await memoryEnabled(file)).toBe(true);
  await writeFile(file, "[memory]\nenabled = false\n");
  expect(await memoryEnabled(file)).toBe(false);
  await writeFile(file, "[memory]\ncmem = false\n");
  expect(await memoryEnabled(file)).toBe(false);
  await writeFile(file, "not toml [");
  expect(await memoryEnabled(file)).toBe(true);
});

it("shows the folder's latest memories in full, with counts by type", () => {
  addMemories(db, [
    memory({
      title: "Fixed",
      subtitle: "The timer",
      type: "bugfix",
      facts: ["It started at 04:59"],
      filesRead: ["src/a.ts", "src/b.ts"],
      filesModified: ["src/a.ts"],
      createdAt: 5,
    }),
    memory({ title: "Gist", type: "summary", createdAt: 6 }),
    memory({ title: "Elsewhere", folder: "/work/other" }),
  ]);
  const status = memoryStatus("/work/app", {}, db);
  expect(status.counts).toEqual({ bugfix: 1 });
  expect(status.observations).toEqual([
    {
      id: expect.any(Number),
      title: "Fixed",
      subtitle: "The timer",
      type: "bugfix",
      createdAt: 5,
      platform: "ignite",
      facts: ["It started at 04:59"],
      files: ["src/a.ts", "src/b.ts"],
    },
  ]);
  expect(memoryStatus(undefined, {}, db)).toEqual({
    counts: {},
    observations: [],
  });
});

it("filters by type and searches, never listing summaries", () => {
  addMemories(db, [
    memory({ title: "Timer starts at 05:00", type: "bugfix", createdAt: 1 }),
    memory({ title: "Timer keeps its theme", type: "feature", createdAt: 2 }),
    memory({ title: "Timer work", type: "summary", createdAt: 3 }),
  ]);
  const titles = (filter: object) =>
    memoryStatus("/work/app", filter, db).observations.map((m) => m.title);
  expect(titles({ kind: "bugfix" })).toEqual(["Timer starts at 05:00"]);
  expect(titles({ query: "timer" })).toHaveLength(2);
  expect(titles({ query: "timer", kind: "feature" })).toEqual([
    "Timer keeps its theme",
  ]);
  expect(titles({ query: "  " })).toEqual([
    "Timer keeps its theme",
    "Timer starts at 05:00",
  ]);
});

const fakeCmem = (file: string) => {
  const cmem = new DatabaseSync(file);
  cmem.exec(`
    CREATE TABLE sdk_sessions (memory_session_id TEXT, content_session_id TEXT, project TEXT, cwd TEXT, platform_source TEXT);
    CREATE TABLE observations (id INTEGER PRIMARY KEY, memory_session_id TEXT, type TEXT, title TEXT, subtitle TEXT, facts TEXT, narrative TEXT, concepts TEXT, files_read TEXT, files_modified TEXT, created_at_epoch INTEGER);
    CREATE TABLE session_summaries (id INTEGER PRIMARY KEY, memory_session_id TEXT, request TEXT, created_at_epoch INTEGER);
    INSERT INTO sdk_sessions VALUES ('m1', 'c1', 'app', '/work/app', 'claude');
    INSERT INTO observations (memory_session_id, type, title, created_at_epoch) VALUES ('m1', 'bugfix', 'One', 1);
  `);
  cmem.close();
};

it("imports cmem's memories at start while memory is on", async () => {
  const file = join(dir, "claude-mem.db");
  fakeCmem(file);
  await turnOff();
  await importOnStart(db, file);
  expect(count(db, "/work/app")).toBe(0);
  await rm(join(dir, `.${APP_NAME}`), { recursive: true });
  await importOnStart(db, file);
  expect(count(db, "/work/app")).toBe(1);
});

it("starts quietly when cmem's database can't be read", async () => {
  const file = join(dir, "claude-mem.db");
  await writeFile(file, "not a database");
  await expect(importOnStart(db, file)).resolves.toBeUndefined();
  expect(count(db, "/work/app")).toBe(0);
});
