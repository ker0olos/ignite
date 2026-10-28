// @vitest-environment node
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Agent } from "./hostTypes.ts";
import type { NewMemory } from "./memoryDb.ts";
import { memory } from "./testMemory.ts";

const mocks = vi.hoisted(() => ({
  askModel: vi.fn(),
  cheapest: vi.fn(),
  enabled: vi.fn(),
  git: vi.fn(),
  log: vi.fn(),
  procedures: vi.fn(),
}));
vi.mock("./cheapCall.ts", () => ({
  askModel: mocks.askModel,
  cheapest: mocks.cheapest,
}));
vi.mock("./memory.ts", () => ({ memoryEnabled: mocks.enabled }));
vi.mock("./gitRun.ts", () => ({ run: mocks.git }));
vi.mock("./hostLog.ts", () => ({ log: mocks.log }));
vi.mock("./learningSettings.ts", () => ({ learningOn: mocks.procedures }));

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "memory-consolidate-"));
  vi.stubEnv("HOME", dir);
  vi.resetModules();
  mocks.askModel.mockReset().mockResolvedValue(null);
  mocks.cheapest.mockReset().mockResolvedValue({ model: { id: "cheap" } });
  mocks.enabled.mockReset().mockResolvedValue(true);
  mocks.git.mockReset().mockResolvedValue({ output: "", code: 0 });
  mocks.log.mockReset();
  mocks.procedures.mockReset().mockResolvedValue(true);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  (await import("./memoryDb.ts")).memoryDb(join(dir, "memory.db")).close();
  await rm(dir, { recursive: true, force: true });
});

const agent = (session: object | null = {}) =>
  ({ cwd: dir, session }) as unknown as Agent;

/** The module under test and a database holding `n` raw memories of each of `files`, which exist in the folder. */
async function setup(files: string[], n = 8, over: Partial<NewMemory> = {}) {
  await Promise.all(files.map((f) => writeFile(join(dir, f), "x")));
  const { consolidate } = await import("./memoryConsolidate.ts");
  const { addMemories, memoryDb } = await import("./memoryDb.ts");
  const db = memoryDb(join(dir, "memory.db"));
  const now = Date.now();
  addMemories(
    db,
    files.flatMap((file, f) =>
      Array.from({ length: n }, (_, i) =>
        memory({
          folder: dir,
          title: `${file} ${i}`,
          filesModified: [file],
          createdAt: now - (f * n + n - i) * 1e3,
          ...over,
        }),
      ),
    ),
  );
  const fresh = async () => {
    vi.resetModules();
    return (await import("./memoryConsolidate.ts")).consolidate;
  };
  return { consolidate, db, fresh };
}

const retired = (db: { prepare: (s: string) => { all: () => unknown[] } }) =>
  db.prepare("SELECT title FROM memories WHERE retired_at IS NOT NULL").all();
const merged = (ids: number[], title = "Merged") =>
  JSON.stringify({
    entries: [{ type: "bugfix", title, facts: ["f"], sources: ids }],
  });

it("does nothing when memory is off, there is no session or no model", async () => {
  const { consolidate, db } = await setup(["a.txt"]);
  mocks.enabled.mockResolvedValue(false);
  await consolidate(agent(), db);
  mocks.enabled.mockResolvedValue(true);
  await consolidate(agent(null), db);
  mocks.cheapest.mockResolvedValue(null);
  await consolidate(agent(), db);
  expect(mocks.askModel).not.toHaveBeenCalled();
  expect(mocks.log).not.toHaveBeenCalled();
});

it("merges a file's memories on the cheapest model, weighed against the file and its commits", async () => {
  mocks.git.mockResolvedValue({ output: "abc1234 2026-10-01 fix\n", code: 0 });
  mocks.askModel.mockResolvedValue(merged([1, 2]));
  const { consolidate, db } = await setup(["a.txt"]);
  await writeFile(join(dir, "a.txt"), "now it reads this");
  await consolidate(agent(), db);
  const [s, model, prompt, input, options] = mocks.askModel.mock.calls[0];
  expect(model).toEqual({ id: "cheap" });
  expect(prompt).toContain("Reply with JSON only");
  expect(input).toContain("[1] ");
  expect(input).toContain("The file as it is now (a.txt):\nnow it reads this");
  expect(input).toContain("since the oldest memory:\nabc1234 2026-10-01 fix");
  expect(options.label).toBe("consolidation of a.txt");
  expect(s).toEqual({});
  const args = mocks.git.mock.calls[0][1] as string[];
  expect(args.slice(1, 3)).toEqual(["--exclude=refs/ignite/*", "--all"]);
  expect(args.slice(-2)).toEqual(["--", "a.txt"]);
  expect(mocks.git.mock.calls[0][2]).toMatchObject({ cwd: dir });
  expect(retired(db)).toHaveLength(2);
  expect(db.prepare("SELECT key FROM consolidations").all()).toEqual([
    { key: "a.txt" },
  ]);
});

it("tells the model what it couldn't read: no commits, git failing", async () => {
  mocks.git.mockResolvedValue({ output: "  ", code: 0 });
  const { consolidate, db, fresh } = await setup(["a.txt"]);
  await consolidate(agent(), db);
  const input = (call: number) => mocks.askModel.mock.calls[call][3];
  expect(input(0)).toContain("The file as it is now (a.txt):\nx");
  expect(input(0)).toContain("\n(none)");
  mocks.git.mockResolvedValue({ output: "x", code: 1 });
  await (
    await fresh()
  )(agent(), db);
  expect(input(1)).not.toContain("Commits that changed");
  mocks.git.mockRejectedValue(new Error("no git"));
  await (
    await fresh()
  )(agent(), db);
  expect(input(2)).not.toContain("Commits that changed");
});

it("skips a group whose file is missing without a deletion, trying it again only once it grows", async () => {
  const { consolidate, db } = await setup([]);
  const { addMemories } = await import("./memoryDb.ts");
  const add = (n: number) =>
    addMemories(
      db,
      Array.from({ length: n }, () =>
        memory({
          folder: dir,
          filesModified: ["gone.txt"],
          createdAt: Date.now(),
        }),
      ),
    );
  add(8);
  await consolidate(agent(), db);
  await consolidate(agent(), db);
  expect(mocks.askModel).not.toHaveBeenCalled();
  expect(db.prepare("SELECT key FROM consolidations").all()).toEqual([]);
  expect(retired(db)).toEqual([]);
  const checks = mocks.git.mock.calls.length;
  expect(checks).toBe(1);
  add(1);
  await consolidate(agent(), db);
  expect(mocks.git.mock.calls.length).toBe(2);
});

it("doesn't look up a model when no group is ready", async () => {
  const { consolidate, db } = await setup(["a.txt"], 7);
  await consolidate(agent(), db);
  expect(mocks.cheapest).not.toHaveBeenCalled();
});

it("leaves the procedures out when learning them is off", async () => {
  mocks.procedures.mockResolvedValue(false);
  const { consolidate, db } = await setup(["x"], 6, {
    concepts: ["procedure"],
  });
  await consolidate(agent(), db);
  expect(mocks.askModel).not.toHaveBeenCalled();
  mocks.procedures.mockResolvedValue(true);
  await (
    await (async () => (
      vi.resetModules(),
      (await import("./memoryConsolidate.ts")).consolidate
    ))()
  )(agent(), db);
  expect(mocks.askModel).toHaveBeenCalledTimes(1);
});

it("shows a code file as its outline", async () => {
  const { consolidate, db } = await setup(["a.ts"]);
  await writeFile(
    join(dir, "a.ts"),
    "export function tick() {\n  return 1;\n}\n",
  );
  await consolidate(agent(), db);
  const input = mocks.askModel.mock.calls[0][3] as string;
  expect(input).toContain("The file as it is now (a.ts):\n");
  expect(input).toContain("tick");
  expect(input).not.toContain("return 1");
});

it("runs at most 2 passes, most pending first", async () => {
  const { consolidate, db } = await setup(["a.txt", "b.txt", "c.txt"]);
  await consolidate(agent(), db);
  expect(mocks.askModel).toHaveBeenCalledTimes(2);
});

it("runs one consolidation at a time", async () => {
  let release!: (reply: string | null) => void;
  mocks.askModel.mockReturnValueOnce(new Promise((r) => (release = r)));
  const { consolidate, db } = await setup(["a.txt"]);
  const first = consolidate(agent(), db);
  await vi.waitFor(() => expect(mocks.askModel).toHaveBeenCalled());
  await consolidate(agent(), db);
  expect(mocks.cheapest).toHaveBeenCalledTimes(1);
  release(null);
  await first;
  const { addMemories } = await import("./memoryDb.ts");
  addMemories(db, [
    memory({ folder: dir, filesModified: ["a.txt"], createdAt: Date.now() }),
  ]);
  await consolidate(agent(), db);
  expect(mocks.cheapest).toHaveBeenCalledTimes(2);
});

it("doesn't try a group again whose pass came to nothing, until it grows", async () => {
  const { consolidate, db, fresh } = await setup(["a.txt"]);
  await consolidate(agent(), db);
  await consolidate(agent(), db);
  expect(mocks.askModel).toHaveBeenCalledTimes(1);
  mocks.askModel.mockResolvedValue("not an outcome");
  const second = await fresh();
  await second(agent(), db);
  await second(agent(), db);
  expect(mocks.askModel).toHaveBeenCalledTimes(2);
  expect(retired(db)).toEqual([]);
  expect(db.prepare("SELECT key FROM consolidations").all()).toEqual([]);
  const { addMemories } = await import("./memoryDb.ts");
  addMemories(db, [
    memory({ folder: dir, filesModified: ["a.txt"], createdAt: Date.now() }),
  ]);
  await second(agent(), db);
  expect(mocks.askModel).toHaveBeenCalledTimes(3);
});

it("logs a failure and carries on, never throwing", async () => {
  const { consolidate, db } = await setup(["a.txt"]);
  mocks.askModel.mockRejectedValueOnce(new Error("boom"));
  await expect(consolidate(agent(), db)).resolves.toBeUndefined();
  expect(mocks.log).toHaveBeenCalledWith(expect.stringContaining("boom"));
  mocks.askModel.mockResolvedValue(merged([1]));
  await consolidate(agent(), db);
  expect(retired(db)).toHaveLength(1);
});

it("reads the default memory when given no database", async () => {
  mocks.askModel.mockResolvedValue(merged([1]));
  await writeFile(join(dir, "a.txt"), "x");
  const { addMemories, memoryDb } = await import("./memoryDb.ts");
  const { consolidate } = await import("./memoryConsolidate.ts");
  const db = memoryDb();
  const now = Date.now();
  addMemories(
    db,
    Array.from({ length: 8 }, (_, i) =>
      memory({
        folder: dir,
        title: `m${i}`,
        filesModified: ["a.txt"],
        createdAt: now - i * 1e3,
      }),
    ),
  );
  await consolidate(agent());
  expect(mocks.askModel).toHaveBeenCalledTimes(1);
  expect(retired(db)).toHaveLength(1);
  db.close();
});

it("starts one consolidation when two runs settle together", async () => {
  const { consolidate, db } = await setup(["a.txt"]);
  await Promise.all([consolidate(agent(), db), consolidate(agent(), db)]);
  expect(mocks.askModel).toHaveBeenCalledTimes(1);
});

it("never reads a file git doesn't track, or one through a link", async () => {
  mocks.git.mockImplementation(async (_: string, args: string[]) =>
    args[0] === "ls-files" ? { output: "", code: 1 } : { output: "", code: 0 },
  );
  const { consolidate, db, fresh } = await setup(["a.txt"]);
  await consolidate(agent(), db);
  const input = (call: number) => mocks.askModel.mock.calls[call][3] as string;
  expect(input(0)).toContain("(not tracked by git, not read)");
  await rm(join(dir, "a.txt"));
  const away = await mkdtemp(join(tmpdir(), "memory-away-"));
  await writeFile(join(away, "secret"), "key=1");
  await symlink(join(away, "secret"), join(dir, "a.txt"));
  await (
    await fresh()
  )(agent(), db);
  expect(input(1)).toContain("(outside the folder, not read)");
  expect(input(1)).not.toContain("key=1");
  await rm(away, { recursive: true, force: true });
});
