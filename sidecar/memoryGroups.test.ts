// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { APP_NAME } from "../src/lib/app.ts";
import { memory } from "./testMemory.ts";
import { worktreeBase } from "./worktreeGit.ts";
import { addMemories, memoryDb, type NewMemory } from "./memoryDb.ts";
import {
  fileKey,
  groups,
  PROCEDURES_KEY,
  triedKey,
  type Tried,
  type Group,
} from "./memoryGroups.ts";

let dir: string;
let db: DatabaseSync;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "memory-groups-"));
  db = memoryDb(join(dir, "memory.db"));
});
afterEach(async () => {
  db.close();
  await rm(dir, { recursive: true, force: true });
});

const FOLDER = "/work/app";
const NOW = 100 * 864e5;
const DAY = 864e5;

/** `n` memories of `file`, a second apart ending `ago` ms before NOW. */
const pile = (
  n: number,
  file: string,
  over: Partial<NewMemory> = {},
  ago = 1e3,
) =>
  addMemories(
    db,
    Array.from({ length: n }, (_, i) =>
      memory({
        title: `${file} ${i}`,
        filesModified: [file],
        createdAt: NOW - ago - (n - i) * 1e3,
        ...over,
      }),
    ),
  );

const all = (skip?: Tried, procedures?: boolean) => [
  ...groups(db, FOLDER, { skip, procedures, now: NOW }),
];
const titles = (g: Group) => g.raw.map((m) => m.title);

describe("fileKey", () => {
  it("is the path from the folder's root", () => {
    expect(fileKey(FOLDER, `${FOLDER}/src/a.ts`)).toBe("src/a.ts");
    expect(fileKey(FOLDER, "src/a.ts")).toBe("src/a.ts");
    expect(fileKey(FOLDER, "./src/a.ts")).toBe("src/a.ts");
    expect(fileKey(FOLDER, "a/./b/../c.ts")).toBe("a/c.ts");
  });

  it("takes a Windows separator after the folder", () => {
    expect(fileKey("C:\\work\\app", "C:\\work\\app\\src\\a.ts")).toBe(
      "src/a.ts",
    );
  });

  it("reads its own worktree's absolute path as the folder's, either separator", () => {
    const tree = basename(worktreeBase(FOLDER));
    expect(
      fileKey(FOLDER, `/home/u/.${APP_NAME}/worktrees/${tree}/s1/src/a.ts`),
    ).toBe("src/a.ts");
    expect(
      fileKey(
        FOLDER,
        `C:\\Users\\u\\.${APP_NAME}\\worktrees\\${tree}\\s1\\src\\a.ts`,
      ),
    ).toBe("src/a.ts");
    expect(
      fileKey(FOLDER, `/home/u/.${APP_NAME}/worktrees/other-1f/s1/src/a.ts`),
    ).toBeNull();
  });

  it("is null outside the folder", () => {
    expect(fileKey(FOLDER, "/work/app2/a.ts")).toBeNull();
    expect(fileKey(FOLDER, "/etc/hosts")).toBeNull();
  });

  it("is null for a path that escapes the folder, also in a worktree", () => {
    const tree = `/home/u/.${APP_NAME}/worktrees/${basename(worktreeBase(FOLDER))}/s1`;
    for (const path of [
      "../x",
      "a/../../x",
      `${FOLDER}/../x`,
      `${FOLDER}/a/../../x`,
      `${tree}/../x`,
    ])
      expect(fileKey(FOLDER, path)).toBeNull();
  });
});

describe("groups of files", () => {
  it("need 8 raw memories of the file in the last 30 days", () => {
    pile(7, "src/a.ts");
    expect(all()).toEqual([]);
    pile(1, "src/a.ts", { title: "eighth" });
    const [g, ...rest] = all();
    expect(rest).toEqual([]);
    expect(g.key).toBe("src/a.ts");
    expect(g.raw).toHaveLength(8);
    expect(g.longTerm).toEqual([]);
  });

  it("count none from before the window, and list by id", () => {
    pile(7, "src/a.ts");
    pile(1, "src/a.ts", { title: "ancient" }, 31 * DAY);
    expect(all()).toEqual([]);
    pile(1, "src/a.ts", { title: "newest" }, 0);
    const [g] = all();
    expect(g.raw).toHaveLength(9);
    expect(g.raw.map((m) => m.id)).toEqual(
      [...g.raw.map((m) => m.id)].sort((a, b) => a - b),
    );
    expect(g.raw[0].title).toBe("src/a.ts 0");
    expect(g.raw.at(-1)!.title).toBe("newest");
  });

  it("count only raw memories of the folder's files", () => {
    pile(2, "src/a.ts");
    pile(1, "src/a.ts", { type: "summary" });
    pile(1, "src/a.ts", { concepts: ["consolidated"] });
    pile(1, "src/a.ts", { concepts: ["procedure"] });
    pile(1, "src/a.ts", { folder: "/work/other" });
    pile(1, "/etc/a.ts");
    pile(1, "src/a.ts");
    db.prepare("UPDATE memories SET retired_at = 9 WHERE id = 1").run();
    expect(all()).toEqual([]);
    pile(5, "src/a.ts");
    expect(all()).toEqual([]);
    pile(1, "src/a.ts");
    expect(all()[0].raw).toHaveLength(8);
  });

  it("count a memory under each file it changed, most pending first", () => {
    pile(8, "src/a.ts", { filesModified: ["src/a.ts", `${FOLDER}/src/b.ts`] });
    pile(2, "src/b.ts");
    expect(all().map((g) => g.key)).toEqual(["src/b.ts", "src/a.ts"]);
    expect(all()[0].raw).toHaveLength(10);
  });

  it("take only the memories since the key's last pass", () => {
    pile(10, "src/a.ts");
    const last = 5;
    db.prepare(
      "INSERT INTO consolidations (folder, key, last_id, at) VALUES (?, ?, ?, 0)",
    ).run(FOLDER, "src/a.ts", last);
    expect(all()).toEqual([]);
    pile(8, "src/a.ts", { title: "later" }, 0);
    const [g] = all();
    expect(g.raw.every((m) => m.id > last)).toBe(true);
    expect(g.raw).toHaveLength(13);
  });

  it("take a memory with an older time but a higher id than the last pass", () => {
    pile(8, "src/a.ts");
    db.prepare(
      "INSERT INTO consolidations (folder, key, last_id, at) VALUES (?, ?, ?, 0)",
    ).run(FOLDER, "src/a.ts", 8);
    expect(all()).toEqual([]);
    pile(8, "src/a.ts", { title: "imported" }, 20 * DAY);
    const [g] = all();
    expect(titles(g).every((t) => t.startsWith("imported"))).toBe(true);
    expect(g.raw).toHaveLength(8);
  });

  it("name the file exactly, not a longer path or a pattern", () => {
    pile(8, "src/a.ts");
    pile(2, "lib/src/a.ts");
    pile(2, "src/a_ts");
    const [g] = all();
    expect(g.raw.map((m) => m.filesModified[0])).toEqual(
      Array(8).fill("src/a.ts"),
    );
  });

  it("find a file whose name has a quote, and one written with Windows separators", () => {
    pile(8, 'src/a"b.ts');
    pile(8, "src\\c\\d.ts");
    expect(
      all()
        .map((g) => g.key)
        .sort(),
    ).toEqual(['src/a"b.ts', "src/c/d.ts"]);
    expect(all().every((g) => g.raw.length === 8)).toBe(true);
  });

  it("carry the file's 3 newest live long-term memories", () => {
    pile(8, "src/a.ts");
    const lt = (title: string, createdAt: number, over = {}) =>
      memory({
        title,
        createdAt,
        filesModified: ["src/a.ts"],
        concepts: ["consolidated"],
        ...over,
      });
    addMemories(db, [
      lt("lt 1", 1),
      lt("lt 2", 2),
      lt("lt 3", 3),
      lt("lt 4", 4),
      lt("lt retired", 5),
      lt("lt procedure", 6, { concepts: ["consolidated", "procedure"] }),
      lt("lt other", 7, { filesModified: ["src/b.ts"] }),
    ]);
    db.prepare(
      "UPDATE memories SET retired_at = 9 WHERE title = 'lt retired'",
    ).run();
    expect(all()[0].longTerm.map((m) => m.title)).toEqual([
      "lt 4",
      "lt 3",
      "lt 2",
    ]);
  });
});

describe("the procedures' group", () => {
  const procedures = (n: number, over: Partial<NewMemory> = {}) =>
    pile(n, "x", { concepts: ["procedure"], filesModified: [], ...over });

  it("needs 6 raw procedures and comes before the files", () => {
    procedures(5);
    pile(8, "src/a.ts");
    expect(all().map((g) => g.key)).toEqual(["src/a.ts"]);
    procedures(1, { title: "sixth" });
    const found = all();
    expect(found.map((g) => g.key)).toEqual([PROCEDURES_KEY, "src/a.ts"]);
    expect(found[0].raw).toHaveLength(6);
    expect(found[1].raw).toHaveLength(8);
  });

  it("is left out when procedures are off", () => {
    procedures(6);
    pile(8, "src/a.ts");
    expect(all(undefined, false).map((g) => g.key)).toEqual(["src/a.ts"]);
  });

  it("takes those since its last pass, with 10 long-term procedures", () => {
    procedures(8);
    for (let i = 0; i < 12; i++)
      addMemories(db, [
        memory({
          title: `lt ${i}`,
          createdAt: i,
          concepts: ["consolidated", "procedure"],
        }),
      ]);
    expect(all()[0].longTerm.map((m) => m.title)).toEqual(
      Array.from({ length: 10 }, (_, i) => `lt ${11 - i}`),
    );
    db.prepare(
      "INSERT INTO consolidations (folder, key, last_id, at) VALUES (?, ?, ?, 0)",
    ).run(FOLDER, PROCEDURES_KEY, 8);
    expect(all()).toEqual([]);
  });
});

describe("a group's cap", () => {
  it("is 40 raw memories", () => {
    pile(45, "src/a.ts");
    expect(all()[0].raw).toHaveLength(40);
    expect(titles(all()[0])[39]).toBe("src/a.ts 39");
  });

  it("knows its newest pending memory, past the 40 taken", () => {
    pile(45, "src/a.ts");
    const [g] = all();
    expect(g.newest).toBe(45);
  });

  it("is the first 40 by id", () => {
    pile(38, "src/a.ts");
    pile(5, "src/a.ts", { title: "tied", createdAt: NOW });
    const [g] = all();
    expect(g.raw.map((m) => m.id)).toEqual(
      Array.from({ length: 40 }, (_, i) => i + 1),
    );
  });
});

describe("skipping", () => {
  it("leaves out a group tried at its newest memory, until it grows", () => {
    pile(8, "src/a.ts");
    procedures6();
    const [p, f] = all();
    const skip: Tried = new Map([
      [triedKey(FOLDER, p), p.newest],
      [triedKey(FOLDER, f), f.newest],
    ]);
    expect(all(skip)).toEqual([]);
    pile(1, "src/a.ts", { title: "new" }, 0);
    expect(all(skip).map((g) => g.key)).toEqual(["src/a.ts"]);
  });

  it("keeps one slot per folder and key", () => {
    pile(8, "src/a.ts");
    const [g] = all();
    expect(triedKey(FOLDER, g)).toBe(`${FOLDER}\0src/a.ts`);
    expect(triedKey("/work/other", g)).not.toBe(triedKey(FOLDER, g));
  });
});

function procedures6() {
  pile(6, "x", { concepts: ["procedure"], filesModified: [] });
}
