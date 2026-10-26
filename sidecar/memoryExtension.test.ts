// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { memory as memoryOf } from "./testMemory.ts";
import { APP_NAME } from "../src/lib/app.ts";
import { addMemories, memoryDb } from "./memoryDb.ts";
import memory, { fullText, MEMORY_TOOLS } from "./memoryExtension.ts";

type Handler = (event: unknown, ctx: unknown) => unknown;
type Tool = {
  name: string;
  execute: (...args: unknown[]) => Promise<{ content: { text: string }[] }>;
};

let dir: string;
let file: string;
let handlers: Map<string, Handler>;
let tools: Map<string, Tool>;
const ctx = { cwd: "/work/app" };

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "memory-ext-"));
  vi.stubEnv("HOME", dir);
  vi.stubEnv("TZ", "UTC");
  file = join(dir, "memory.db");
  handlers = new Map();
  tools = new Map();
});
afterEach(async () => {
  vi.unstubAllEnvs();
  memoryDb(file).close();
  await rm(dir, { recursive: true, force: true });
});

const load = () =>
  memory(
    {
      on: (name: string, h: Handler) => handlers.set(name, h),
      registerTool: (t: Tool) => tools.set(t.name, t),
    } as unknown as ExtensionAPI,
    file,
  );

const turnOff = async () => {
  await mkdir(join(dir, `.${APP_NAME}`), { recursive: true });
  await writeFile(
    join(dir, `.${APP_NAME}`, "settings.toml"),
    "[memory]\nenabled = false\n",
  );
};

const run = (name: string, params: object) =>
  tools
    .get(name)!
    .execute("call", params, undefined, undefined, ctx)
    .then((r) => r.content[0].text);

/** The prompt sections a run starts with, after the extension's turn. */
const start = async () => {
  const sections: Record<string, string> = { tools: "base" };
  await handlers.get("before_agent_start")!(
    { systemPrompt: "base", systemPromptOptions: { sections } },
    ctx,
  );
  return sections;
};

it("adds nothing when memory is off", async () => {
  await turnOff();
  await load();
  expect(tools.size).toBe(0);
  expect(handlers.size).toBe(0);
});

it("recalls the folder's memories once per conversation", async () => {
  addMemories(memoryDb(file), [memoryOf({ title: "Fixed the timer" })]);
  await load();
  expect([...tools.keys()]).toEqual(MEMORY_TOOLS);
  expect((await start()).memory).toMatch(
    /^# Memory: recent work in app[\s\S]*Fixed the timer/,
  );
  addMemories(memoryDb(file), [memoryOf({ title: "Later" })]);
  expect((await start()).memory).not.toContain("Later");
  handlers.get("session_start")!({}, ctx);
  expect((await start()).memory).toContain("Later");
});

it("leaves the prompt alone with nothing to recall, or once turned off", async () => {
  await load();
  expect(await start()).toEqual({ tools: "base" });
  addMemories(memoryDb(file), [memoryOf()]);
  await turnOff();
  expect(await start()).toEqual({ tools: "base" });
});

it("never stops a run when the memory can't be read", async () => {
  await writeFile(join(dir, "blocked"), "");
  file = join(dir, "blocked", "memory.db");
  await load();
  expect(await start()).toEqual({ tools: "base" });
  file = join(dir, "memory.db");
});

it("leaves procedures out of what the agent recalls and reads while they're off", async () => {
  addMemories(memoryDb(file), [
    memoryOf({ title: "Running the tests", concepts: ["procedure"] }),
    memoryOf({ title: "Tests were slow", createdAt: 2_000 }),
  ]);
  await mkdir(join(dir, `.${APP_NAME}`), { recursive: true });
  await writeFile(
    join(dir, `.${APP_NAME}`, "settings.toml"),
    "[procedures]\nenabled = false\n",
  );
  await load();
  const recalled = (await start()).memory;
  expect(recalled).toContain("Tests were slow");
  expect(recalled).not.toContain("Running the tests");
  expect(await run("memory_search", { query: "tests" })).not.toContain(
    "Running the tests",
  );
  expect(await run("memory_get", { ids: [1] })).toBe(
    "No memory has these ids.",
  );
  expect(await run("memory_timeline", { id: 2, before: 3 })).not.toContain(
    "Running the tests",
  );
  // Back on, the agent gets them again.
  await writeFile(join(dir, `.${APP_NAME}`, "settings.toml"), "");
  expect(await run("memory_get", { ids: [1] })).toContain("Running the tests");
});

it("searches, reads and steps through the folder's memories", async () => {
  addMemories(memoryDb(file), [
    memoryOf({
      title: "Timer starts at 04:59",
      type: "bugfix",
      createdAt: Date.parse("2026-10-01"),
    }),
    memoryOf({
      title: "Settings in localStorage",
      type: "decision",
      createdAt: Date.parse("2026-10-02"),
    }),
  ]);
  await load();
  expect(await run("memory_search", { query: "timer" })).toMatch(
    /^Best match first:\n1 Oct 1, 2026 .* ● Timer starts at 04:59$/,
  );
  addMemories(memoryDb(file), [
    memoryOf({
      title: "Timer note",
      narrative: "timer timer timer",
      type: "change",
      createdAt: Date.parse("2026-10-03"),
    }),
  ]);
  // Best first, not newest first: the note says "timer" most.
  expect(await run("memory_search", { query: "timer" })).toMatch(
    /^Best match first:\n3 .*Timer note\n1 .*04:59$/,
  );
  expect(
    await run("memory_search", { query: "timer", types: ["decision"] }),
  ).toBe("Nothing remembered matches.");
  expect(
    await run("memory_search", { query: "settings", since: "2026-10-02" }),
  ).toContain("localStorage");
  expect(
    await run("memory_search", { query: "timer", since: "nonsense" }),
  ).toContain("04:59");
  expect(await run("memory_get", { ids: [2, 1] })).toMatch(
    /^\[2\] decision[\s\S]*---[\s\S]*\[1\] bugfix/,
  );
  expect(await run("memory_get", { ids: [9] })).toBe(
    "No memory has these ids.",
  );
  addMemories(memoryDb(file), [memoryOf({ folder: "/work/other" })]);
  expect(await run("memory_get", { ids: [4] })).toBe(
    "No memory has these ids.",
  );
  expect(await run("memory_timeline", { id: 4 })).toBe(
    "No memory has this id.",
  );
  expect(await run("memory_timeline", { id: 1 })).toContain("localStorage");
  expect(await run("memory_timeline", { id: 9 })).toBe(
    "No memory has this id.",
  );
  expect(await run("memory_search", { query: "s", limit: -1 })).toMatch(
    /^Best match first:\n\d+ [^\n]*$/,
  );
  expect(
    await run("memory_timeline", { id: 1, before: -1, after: -1 }),
  ).not.toContain("localStorage");
});

it("reads a memory in full", () => {
  const text = fullText({
    ...memoryOf({
      title: "Fixed",
      subtitle: "The timer",
      facts: ["a", "b"],
      narrative: "Why it broke",
      filesRead: ["x.ts"],
      filesModified: ["y.ts", "z.ts"],
    }),
    id: 4,
  });
  expect(text).toMatch(
    /^\[4\] discovery · .* · ignite\nFixed\nThe timer\nFacts:\n- a\n- b\nWhy it broke\n/,
  );
  expect(text).toContain("Files read: x.ts\nFiles modified: y.ts, z.ts");
  expect(fullText({ ...memoryOf({ title: "Bare" }), id: 1 })).toMatch(
    /\nBare$/,
  );
});
