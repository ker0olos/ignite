// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, expect, it } from "vitest";
import { memoryDb } from "./memoryDb.ts";
import { WORKTREES } from "./worktreeGit.ts";
import {
  fromObservation,
  fromSummary,
  importCmem,
  sessionsOf,
} from "./memoryImport.ts";
import { recent } from "./memorySearch.ts";

let dir: string;
let cmemFile: string;
let db: DatabaseSync;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "memory-import-"));
  cmemFile = join(dir, "claude-mem.db");
  db = memoryDb(join(dir, "memory.db"));
});
afterEach(async () => {
  db.close();
  await rm(dir, { recursive: true, force: true });
});

const SESSION = { folder: "/work/app", platform: "claude", conversation: "c1" };

it("puts each cmem session in the folder its project was worked in", () => {
  const sessions = sessionsOf([
    {
      memory_session_id: "m1",
      content_session_id: "c1",
      project: "app",
      cwd: "/work/app",
      platform_source: "claude",
    },
    {
      memory_session_id: "m2",
      content_session_id: "c2",
      project: "app",
      cwd: null,
      platform_source: "claude",
    },
    {
      memory_session_id: "m3",
      content_session_id: "c3",
      project: "app/abc",
      cwd: "/home/.claude/worktrees/abc",
      platform_source: "claude",
    },
    {
      memory_session_id: "m6",
      content_session_id: "c6",
      project: "app/def",
      cwd: join(WORKTREES, "app-1", "def"),
      platform_source: "claude",
    },
    {
      memory_session_id: "m4",
      content_session_id: "c4",
      project: "lost",
      cwd: "",
      platform_source: "claude",
    },
    {
      memory_session_id: null,
      content_session_id: "c5",
      project: "app",
      cwd: "/work/app",
      platform_source: "claude",
    },
  ]);
  expect([...sessions.keys()]).toEqual(["m1", "m2", "m3"]);
  expect(
    sessionsOf([
      {
        memory_session_id: "w",
        project: "app",
        cwd: "/work/app",
        user_prompt: "Already recorded in this conversation:\n(nothing)",
      },
      {
        memory_session_id: "r",
        project: "app",
        cwd: "/work/app",
        user_prompt: "Models:\n- haiku",
      },
    ]).size,
  ).toBe(0);
  expect(sessions.get("m3")).toEqual({
    folder: "/work/app",
    platform: "claude",
    conversation: "c3",
  });
});

it("keeps two folders of the same name apart, the usual one for sessions that don't say", () => {
  const row = (id: string, cwd: string | null) => ({
    memory_session_id: id,
    content_session_id: id,
    project: "app",
    cwd,
    platform_source: "claude",
  });
  const sessions = sessionsOf([
    row("a", "/home/other/app"),
    row("b", "/work/app"),
    row("c", "/work/app"),
    row("d", null),
  ]);
  expect(sessions.get("a")?.folder).toBe("/home/other/app");
  expect(sessions.get("b")?.folder).toBe("/work/app");
  expect(sessions.get("d")?.folder).toBe("/work/app");
});

it("reads an observation, keeping a type of the model's own as a change", () => {
  const row = {
    id: 7,
    type: "gotcha",
    title: " Timer ",
    subtitle: "",
    facts: '["a"]',
    narrative: "Why",
    concepts: "not json",
    files_read: null,
    files_modified: '["x.ts"]',
    created_at_epoch: 5,
  };
  expect(fromObservation(row, SESSION)).toEqual({
    ...SESSION,
    type: "change",
    title: "Timer",
    subtitle: null,
    facts: ["a"],
    narrative: "Why",
    concepts: [],
    filesRead: [],
    filesModified: ["x.ts"],
    createdAt: 5,
    origin: "cmem:o:7",
  });
  expect(fromObservation({ ...row, type: "bugfix" }, SESSION)?.type).toBe(
    "bugfix",
  );
  expect(fromObservation({ ...row, title: null }, SESSION)).toBeNull();
});

it("reads a summary as its request and sections", () => {
  const row = {
    id: 3,
    request: "Fix the timer",
    investigated: "The countdown",
    learned: null,
    completed: "Fixed",
    files_edited: '["t.ts"]',
    created_at_epoch: 9,
  };
  expect(fromSummary(row, SESSION)).toMatchObject({
    type: "summary",
    title: "Fix the timer",
    narrative: "Investigated: The countdown\n\nCompleted: Fixed",
    filesModified: ["t.ts"],
    origin: "cmem:s:3",
  });
  expect(
    fromSummary({ ...row, investigated: null, completed: null }, SESSION)
      ?.narrative,
  ).toBeNull();
  expect(fromSummary({ ...row, request: " " }, SESSION)).toBeNull();
});

function fakeCmem() {
  const cmem = new DatabaseSync(cmemFile);
  cmem.exec(`
    CREATE TABLE sdk_sessions (memory_session_id TEXT, content_session_id TEXT, project TEXT, cwd TEXT, platform_source TEXT);
    CREATE TABLE observations (id INTEGER PRIMARY KEY, memory_session_id TEXT, type TEXT, title TEXT, subtitle TEXT, facts TEXT, narrative TEXT, concepts TEXT, files_read TEXT, files_modified TEXT, created_at_epoch INTEGER);
    CREATE TABLE session_summaries (id INTEGER PRIMARY KEY, memory_session_id TEXT, request TEXT, investigated TEXT, learned TEXT, completed TEXT, next_steps TEXT, notes TEXT, files_read TEXT, files_edited TEXT, created_at_epoch INTEGER);
    INSERT INTO sdk_sessions VALUES ('m1', 'c1', 'app', '/work/app', 'claude'), ('m2', 'c2', 'gone', NULL, 'claude');
    INSERT INTO observations (memory_session_id, type, title, created_at_epoch) VALUES ('m1', 'bugfix', 'One', 1), ('m2', 'bugfix', 'Lost', 2);
    INSERT INTO session_summaries (memory_session_id, request, created_at_epoch) VALUES ('m1', 'Ask', 3);
  `);
  return cmem;
}

it("imports what cmem added since the last import", () => {
  const cmem = fakeCmem();
  expect(importCmem(db, cmemFile)).toBe(2);
  expect(importCmem(db, cmemFile)).toBe(0);
  cmem.exec(
    "INSERT INTO observations (memory_session_id, type, title, created_at_epoch) VALUES ('m1', 'feature', 'Two', 4)",
  );
  cmem.close();
  expect(importCmem(db, cmemFile)).toBe(1);
  expect(recent(db, "/work/app", 9).map((m) => m.title)).toEqual([
    "Two",
    "One",
  ]);
  expect(recent(db, "/work/app", 9, true).map((m) => m.title)).toEqual(["Ask"]);
});

it("imports what couldn't be placed in a folder once it can be", () => {
  const cmem = fakeCmem();
  expect(importCmem(db, cmemFile)).toBe(2);
  cmem.exec(
    "INSERT INTO sdk_sessions VALUES ('m3', 'c3', 'gone', '/work/gone', 'claude')",
  );
  cmem.close();
  expect(importCmem(db, cmemFile)).toBe(1);
  expect(recent(db, "/work/gone", 9).map((m) => m.title)).toEqual(["Lost"]);
});

it("places no folder from an older cmem without session folders", () => {
  const cmem = new DatabaseSync(cmemFile);
  cmem.exec(`
    CREATE TABLE sdk_sessions (memory_session_id TEXT, content_session_id TEXT, project TEXT, platform_source TEXT);
    CREATE TABLE observations (id INTEGER PRIMARY KEY, memory_session_id TEXT, title TEXT);
    CREATE TABLE session_summaries (id INTEGER PRIMARY KEY, memory_session_id TEXT, request TEXT);
    INSERT INTO sdk_sessions VALUES ('m1', 'c1', 'app', 'claude');
    INSERT INTO observations (memory_session_id, title) VALUES ('m1', 'One');
  `);
  cmem.close();
  expect(importCmem(db, cmemFile)).toBe(0);
});

it("imports a big backlog in batches", () => {
  const cmem = fakeCmem();
  cmem.exec(`
    WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 1200)
    INSERT INTO observations (memory_session_id, type, title, created_at_epoch)
    SELECT 'm1', 'change', 'Note ' || i, 10 + i FROM n;
  `);
  cmem.close();
  expect(importCmem(db, cmemFile)).toBe(1202);
});

it("has nothing to import without cmem", () => {
  expect(importCmem(db, cmemFile)).toBe(0);
});
