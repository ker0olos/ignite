// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AgentMessage, SessionEvent } from "../shared/agentTypes.ts";
import { APP_NAME } from "../src/lib/app.ts";
import { followRun, fromRoot, rememberRun } from "./hostMemory.ts";
import type { Agent } from "./hostTypes.ts";
import { PROCEDURE } from "../shared/memory.ts";
import { addMemories, memoryDb } from "./memoryDb.ts";
import { recent } from "./memorySearch.ts";
import { write } from "./memoryWriter.ts";
import { procedureRule } from "./procedures.ts";
import { memory } from "./testMemory.ts";

vi.mock("./memoryWriter.ts", async (original) => ({
  ...(await original<typeof import("./memoryWriter.ts")>()),
  write: vi.fn(async () => [
    {
      type: "bugfix",
      title: "Fixed the timer",
      subtitle: null,
      facts: [],
      narrative: null,
      concepts: [],
      filesRead: [],
      filesModified: ["src/timer.ts"],
    },
  ]),
}));

let dir: string;
let db: DatabaseSync;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "host-memory-"));
  vi.stubEnv("HOME", dir);
  db = memoryDb(join(dir, "memory.db"));
  vi.mocked(write).mockClear();
});
afterEach(async () => {
  vi.unstubAllEnvs();
  db.close();
  await rm(dir, { recursive: true, force: true });
});

let messages: AgentMessage[];
beforeEach(() => {
  messages = [{ role: "user", content: "earlier", timestamp: 1 }];
});
const agent = () =>
  ({
    id: "s1",
    cwd: "/work/app",
    workdir: "/trees/s1",
    session: {
      get messages() {
        return messages;
      },
    },
  }) as unknown as Agent;

const user = (content: string, timestamp: number) =>
  ({ role: "user", content, timestamp }) as AgentMessage;
const reply = (timestamp: number) =>
  ({ role: "assistant", content: [], timestamp }) as unknown as AgentMessage;

const ran = (a: Agent, ...added: AgentMessage[]) => {
  followRun(a, { type: "agent_start" } as SessionEvent);
  messages.push(...added);
};

it("writes down the run that just settled, in the conversation's folder", async () => {
  const a = agent();
  followRun(a, { type: "message_start" } as SessionEvent);
  expect(a.runAfter).toBeUndefined();
  ran(a, user("fix the timer", 2), reply(3));
  expect(a.runAfter).toBe(1);
  await rememberRun(a, db);
  const [run, recorded, path] = vi.mocked(write).mock.calls[0].slice(1);
  expect(run).toEqual(messages.slice(1));
  expect(recorded).toEqual([]);
  expect((path as (p: string) => string)("/trees/s1/src/a.ts")).toBe(
    "src/a.ts",
  );
  expect(recent(db, "/work/app", 5)).toEqual([
    expect.objectContaining({
      title: "Fixed the timer",
      conversation: "s1",
      platform: APP_NAME,
    }),
  ]);
  expect(a.runAfter).toBeUndefined();
});

it("lets a run with a failed command teach procedures, naming the folder's", async () => {
  addMemories(db, [
    memory({ title: "Running the tests", concepts: [PROCEDURE] }),
  ]);
  const a = agent();
  ran(a, user("look", 2), reply(3));
  await rememberRun(a, db);
  const procedures = (call: number) =>
    vi.mocked(write).mock.calls[call][5]?.procedures;
  expect(procedures(0)).toBeUndefined();
  const failed = {
    role: "toolResult",
    toolName: "bash",
    isError: true,
    content: [{ type: "text", text: "Command exited with code 1" }],
    timestamp: 5,
  } as unknown as AgentMessage;
  ran(a, user("run the tests", 4), failed, reply(6));
  await rememberRun(a, db);
  expect(procedures(1)).toBe(procedureRule(["Running the tests"]));
  // Switched off, the run's memories are still written, without procedures.
  await mkdir(join(dir, `.${APP_NAME}`));
  await writeFile(
    join(dir, `.${APP_NAME}`, "settings.toml"),
    "[procedures]\nenabled = false\n",
  );
  ran(a, user("again", 7), { ...failed, timestamp: 8 }, reply(9));
  await rememberRun(a, db);
  expect(write).toHaveBeenCalledTimes(3);
  expect(procedures(2)).toBeUndefined();
});

it("writes nothing for a run the agent never answered, one it didn't see start, or with memory off", async () => {
  const a = agent();
  await rememberRun(a, db);
  ran(a, user("stopped at once", 2));
  await rememberRun(a, db);
  await mkdir(join(dir, `.${APP_NAME}`));
  await writeFile(
    join(dir, `.${APP_NAME}`, "settings.toml"),
    "[memory]\nenabled = false\n",
  );
  ran(a, reply(3));
  await rememberRun(a, db);
  expect(write).not.toHaveBeenCalled();
});

it("remembers a run from its start when pi starts again within it", async () => {
  const a = agent();
  ran(a, user("fix it", 2));
  ran(a, reply(3));
  expect(a.runAfter).toBe(1);
  await rememberRun(a, db);
  expect(vi.mocked(write).mock.calls[0][1]).toHaveLength(2);
});

it("still remembers a run whose older messages a compaction replaced", async () => {
  const a = agent();
  messages.push(user("before", 2), reply(3));
  ran(a, user("go on", 4), reply(5));
  // The compaction keeps the newest messages, with their times.
  messages = [
    { role: "compactionSummary", timestamp: 6 } as AgentMessage,
    user("go on", 4),
    reply(5),
  ];
  await rememberRun(a, db);
  expect(vi.mocked(write).mock.calls[0][1]).toEqual([
    { role: "compactionSummary", timestamp: 6 },
    user("go on", 4),
    reply(5),
  ]);
});

it("starts a conversation's first run from its first message", () => {
  const a = agent();
  messages = [];
  followRun(a, { type: "agent_start" } as SessionEvent);
  expect(a.runAfter).toBe(0);
});

it("names a path from the folder's root, from the worktree or the folder", () => {
  const path = fromRoot(["/trees/s1", "/work/app"]);
  expect(path("/trees/s1/src/a.ts")).toBe("src/a.ts");
  expect(path("/work/app/b.ts")).toBe("b.ts");
  expect(path("/work/apple/c.ts")).toBe("/work/apple/c.ts");
  expect(path("src/d.ts")).toBe("src/d.ts");
  const windows = fromRoot(["C:\\trees\\s1"]);
  expect(windows("C:\\trees\\s1\\src\\a.ts")).toBe("src\\a.ts");
});
