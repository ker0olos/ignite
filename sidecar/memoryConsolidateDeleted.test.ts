// @vitest-environment node
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Agent } from "./hostTypes.ts";
import type { NewMemory } from "./memoryDb.ts";
import { memory } from "./testMemory.ts";

const mocks = vi.hoisted(() => ({
  askModel: vi.fn(),
  git: vi.fn(),
}));
vi.mock("./cheapCall.ts", () => ({
  askModel: mocks.askModel,
  cheapest: async () => ({ model: { id: "cheap" } }),
}));
vi.mock("./memory.ts", () => ({ memoryEnabled: async () => true }));
vi.mock("./gitRun.ts", () => ({ run: mocks.git }));
vi.mock("./hostLog.ts", () => ({ log: vi.fn() }));
vi.mock("./learningSettings.ts", () => ({ learningOn: async () => true }));

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "memory-deleted-"));
  vi.resetModules();
  mocks.askModel.mockReset().mockResolvedValue(null);
  mocks.git.mockReset();
});
afterEach(async () => {
  (await import("./memoryDb.ts")).memoryDb(join(dir, "memory.db")).close();
  await rm(dir, { recursive: true, force: true });
});

const now = Date.now();
/** Git says the file was deleted 10s ago. */
const deletedAgo10s = (args: string[]) =>
  args.includes("--diff-filter=D")
    ? { output: `${Math.floor((now - 10_000) / 1000)}\n`, code: 0 }
    : { output: "", code: 0 };

async function consolidateWith(memories: Partial<NewMemory>[]) {
  const { consolidate } = await import("./memoryConsolidate.ts");
  const { addMemories, memoryDb } = await import("./memoryDb.ts");
  const db = memoryDb(join(dir, "memory.db"));
  addMemories(
    db,
    memories.map((m, i) =>
      memory({ folder: dir, title: `m${i}`, createdAt: now - 60e3 + i, ...m }),
    ),
  );
  await consolidate({ cwd: dir, session: {} } as unknown as Agent, db);
  return db;
}

const before = (n: number, over: Partial<NewMemory> = {}) =>
  Array.from({ length: n }, () => ({ filesModified: ["a.txt"], ...over }));
const after = { filesModified: ["a.txt"], createdAt: now - 1e3 };
const reasons = (db: Awaited<ReturnType<typeof consolidateWith>>) =>
  db
    .prepare(
      "SELECT title, retired_reason AS why FROM memories WHERE retired_at IS NOT NULL",
    )
    .all();

it("retires a deleted file's own older memories as stale, asking about the rest", async () => {
  mocks.git.mockImplementation(async (_p, args) => deletedAgo10s(args));
  mocks.askModel.mockResolvedValue("{}");
  const db = await consolidateWith([
    ...before(6),
    { filesModified: ["a.txt", "b.txt"] },
    { ...after },
    { ...after },
  ]);
  expect(reasons(db)).toEqual(
    Array.from({ length: 6 }, (_, i) => ({
      title: `m${i}`,
      why: "its file a.txt was deleted",
    })),
  );
  const input = mocks.askModel.mock.calls[0][3] as string;
  expect(input).toContain("m6");
  expect(input).toContain("m8");
  expect(input).not.toContain("m0");
});

it("makes no model call when the deletion frees every memory, and records the pass", async () => {
  mocks.git.mockImplementation(async (_p, args) => deletedAgo10s(args));
  const db = await consolidateWith(before(8));
  expect(mocks.askModel).not.toHaveBeenCalled();
  expect(reasons(db)).toHaveLength(8);
  expect(db.prepare("SELECT key FROM consolidations").all()).toEqual([
    { key: "a.txt" },
  ]);
});

it.each([
  ["no deletion in its history", { output: "", code: 0 }],
  ["git failing", { output: "123", code: 1 }],
  ["git not running", new Error("no git")],
])("skips a missing file on %s: no model call, no pass", async (_, answer) => {
  if (answer instanceof Error) mocks.git.mockRejectedValue(answer);
  else mocks.git.mockResolvedValue(answer);
  const db = await consolidateWith(before(8));
  expect(mocks.askModel).not.toHaveBeenCalled();
  expect(reasons(db)).toEqual([]);
  expect(db.prepare("SELECT key FROM consolidations").all()).toEqual([]);
});

it("asks the model about a file that exists", async () => {
  await writeFile(join(dir, "a.txt"), "x");
  mocks.git.mockResolvedValue({ output: "", code: 0 });
  await consolidateWith(before(8));
  expect(mocks.askModel).toHaveBeenCalledTimes(1);
  expect(mocks.askModel.mock.calls[0][3]).toContain("The file as it is now");
});

it("keeps the procedures from the file checks", async () => {
  const db = await consolidateWith(
    Array.from({ length: 6 }, () => ({ concepts: ["procedure"] })),
  );
  expect(mocks.git).not.toHaveBeenCalled();
  expect(mocks.askModel.mock.calls[0][3]).not.toContain("as it is now");
  expect(mocks.askModel.mock.calls[0][2]).toContain("procedures");
  expect(reasons(db)).toEqual([]);
});
