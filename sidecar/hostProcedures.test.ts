// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PROCEDURE } from "../shared/memory.ts";
import type { HostContext } from "./hostTypes.ts";
import { addMemories, memoryDb } from "./memoryDb.ts";
import { search } from "./memorySearch.ts";
import { memory } from "./testMemory.ts";

let dir: string;
let db: DatabaseSync;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "host-procedures-"));
  db = memoryDb(join(dir, "memory.db"));
  vi.resetModules();
  vi.doMock("./memoryDb.ts", async (original) => ({
    ...(await original<typeof import("./memoryDb.ts")>()),
    memoryDb: () => db,
  }));
});
afterEach(async () => {
  vi.doUnmock("./memoryDb.ts");
  db.close();
  await rm(dir, { recursive: true, force: true });
});

const handlers = async () =>
  (await import("./hostProcedures.ts")).procedureHandlers;

// The folders' saved conversations, as the sidebar titles them.
const ctx = {
  sessions: {
    list: async (folder: string) =>
      folder === "/work/app"
        ? [
            {
              id: "s1",
              title: "Fix the flaky test",
              modified: 1,
              messageCount: 2,
              text: "",
            },
          ]
        : Promise.reject(new Error("unreadable")),
  },
} as unknown as HostContext;

describe("procedureHandlers", () => {
  it("lists every folder's procedures, newest first, with the conversation each was learned in", async () => {
    addMemories(db, [
      memory({
        title: "Running the tests",
        facts: ["pnpm install", "pnpm test"],
        concepts: [PROCEDURE],
        createdAt: 1,
      }),
      // A conversation that's gone can't be opened.
      memory({
        conversation: "gone",
        title: "Seeding the database",
        concepts: [PROCEDURE],
        createdAt: 2,
      }),
      memory({
        folder: "/work/other",
        title: "Signing the build",
        concepts: [PROCEDURE],
        createdAt: 3,
      }),
      memory({ title: "Not a procedure" }),
    ]);
    const listed = await (await handlers()).procedures_list(ctx);
    expect(listed.map((p) => p.title)).toEqual([
      "Signing the build",
      "Seeding the database",
      "Running the tests",
    ]);
    expect(listed[0].from).toBeUndefined();
    expect(listed[1].from).toBeUndefined();
    expect(listed[2]).toMatchObject({
      steps: ["pnpm install", "pnpm test"],
      folder: "/work/app",
      at: 1,
      from: {
        conversation: "s1",
        folder: "/work/app",
        title: "Fix the flaky test",
      },
    });
  });

  it("removes a procedure, from search too, and never another memory", async () => {
    addMemories(db, [
      memory({ title: "Running the tests", concepts: [PROCEDURE] }),
      memory({ title: "Running notes" }),
    ]);
    const all = search(db, "/work/app", "Running", { limit: 10 });
    const procedure = all.find((m) => m.title === "Running the tests")!;
    const other = all.find((m) => m.title === "Running notes")!;
    const h = await handlers();
    expect(
      await h.procedures_remove(ctx, { procedure: other.id }),
    ).toHaveLength(1);
    expect(await h.procedures_remove(ctx, { procedure: procedure.id })).toEqual(
      [],
    );
    expect(
      search(db, "/work/app", "Running", { limit: 10 }).map((m) => m.title),
    ).toEqual(["Running notes"]);
  });
});
