// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentMessage } from "../shared/agentTypes.ts";
import { withFiles } from "../shared/attachedFiles.ts";
import { CODEMODE_TOOL } from "../shared/codemode.ts";
import { LESSON_ADD_TOOL } from "../shared/lessons.ts";
import { PROCEDURE } from "../shared/memory.ts";
import type { Agent, Session } from "./hostTypes.ts";
import { addMemories, memoryDb } from "./memoryDb.ts";
import {
  learnsProcedures,
  pickedFrom,
  pickFor,
  procedureNote,
  procedureRule,
} from "./procedures.ts";
import { memory } from "./testMemory.ts";

const EXITED = "FAIL src/a.test.ts\n\nCommand exited with code 1";

const bash = (text: string, isError = true) =>
  ({
    role: "toolResult",
    toolName: "bash",
    isError,
    content: [{ type: "text", text }],
  }) as unknown as AgentMessage;
const script = (status: string, text: string, name = "bash") =>
  ({
    role: "toolResult",
    toolName: CODEMODE_TOOL,
    content: [{ type: "text", text: "done" }],
    details: {
      calls: [
        {
          id: "c",
          name,
          arguments: {},
          status,
          result: { content: [{ type: "text", text }] },
        },
      ],
      seen: 0,
    },
  }) as unknown as AgentMessage;
const lesson = {
  role: "assistant",
  content: [{ type: "toolCall", id: "l", name: LESSON_ADD_TOOL }],
} as unknown as AgentMessage;

describe("learnsProcedures", () => {
  it("needs a command that failed, in the run or a script's calls", () => {
    expect(learnsProcedures([bash("ok", false)])).toBe(false);
    expect(learnsProcedures([bash(EXITED)])).toBe(true);
    expect(learnsProcedures([script("error", EXITED)])).toBe(true);
    // A script keeps a call's text cut short, past its exit line.
    expect(learnsProcedures([script("error", `${"x".repeat(4000)}…`)])).toBe(
      true,
    );
    expect(learnsProcedures([script("done", EXITED)])).toBe(false);
    expect(learnsProcedures([script("error", EXITED, "read")])).toBe(false);
  });

  it("doesn't take a block, a denial or a redirect for a failure", () => {
    expect(
      learnsProcedures([bash("Blocked by a lesson from a past mistake")]),
    ).toBe(false);
    expect(learnsProcedures([script("error", "Use the grep tool")])).toBe(
      false,
    );
    // The sandbox's block exits non-zero too, with its report.
    const blocked = `curl: (7) failed\n<sandbox_violations>\ncurl(12) deny(1) network-outbound example.com:443\n</sandbox_violations>\nCommand exited with code 7`;
    expect(learnsProcedures([bash(blocked)])).toBe(false);
  });

  it("leaves a run that added a lesson to the lesson", () => {
    expect(learnsProcedures([bash(EXITED), lesson])).toBe(false);
  });
});

describe("procedureRule", () => {
  it("names the folder's procedures so none is recorded again", () => {
    expect(procedureRule([])).not.toContain("already has");
    expect(procedureRule(["Running the tests"])).toContain(
      "already has; record none of them again, even in other words:\n- Running the tests",
    );
  });
});

describe("pickedFrom", () => {
  const listed = [1, 2, 3, 4, 40].map((id) => ({ id }) as never);

  it("keeps the listed procedures a reply of ids names, at most 3", () => {
    expect(pickedFrom("2, 9", listed)).toEqual([{ id: 2 }]);
    expect(pickedFrom(" [3], [40].", listed)).toEqual([{ id: 3 }, { id: 40 }]);
    expect(pickedFrom("1,2,3,4", listed)).toHaveLength(3);
  });

  it("takes no numbers from prose", () => {
    expect(pickedFrom("NONE", listed)).toEqual([]);
    expect(pickedFrom("NONE (0 of 40 apply)", listed)).toEqual([]);
    expect(pickedFrom("None; 3 are close but no", listed)).toEqual([]);
    expect(pickedFrom("I'd pick 3", listed)).toEqual([]);
  });
});

let dir: string;
let db: DatabaseSync;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "procedures-"));
  vi.stubEnv("HOME", dir);
  db = memoryDb(join(dir, "memory.db"));
});
afterEach(async () => {
  vi.unstubAllEnvs();
  db.close();
  await rm(dir, { recursive: true, force: true });
});

const model = {
  provider: "x",
  id: "cheap",
  name: "Cheap",
  cost: { output: 1 },
};
const session = (reply: string) => ({
  model,
  modelRuntime: {
    getModels: () => [model],
    getAvailable: async () => [model],
    completeSimple: vi.fn(async () => ({
      content: [{ type: "text", text: reply }],
      stopReason: "stop",
    })),
  } as unknown as Session["modelRuntime"],
});
const firstId = (db: DatabaseSync) =>
  (db.prepare("SELECT id FROM memories ORDER BY id").get() as { id: number })
    .id;
const live = () => new AbortController().signal;
const user = { role: "user", content: "hi", timestamp: 1 } as AgentMessage;

describe("procedureNote", () => {
  it("offers the procedures the cheapest model picks for the message as typed", async () => {
    addMemories(db, [
      memory({
        title: "Running the sidecar tests",
        facts: ["Run pnpm install first"],
        concepts: [PROCEDURE],
      }),
      memory({ title: "Not a procedure" }),
    ]);
    const s = session(`${firstId(db)}`);
    const typed = withFiles("fix the tests", [
      { path: "/a.txt", text: "file text" },
    ]);
    const note = await procedureNote(s, "/work/app", typed, live(), db);
    expect(note).toMatch(/^Procedures earlier conversations/);
    expect(note).toContain(
      "] Running the sidecar tests\n- Run pnpm install first",
    );
    const [, context, options] = vi.mocked(s.modelRuntime.completeSimple).mock
      .calls[0];
    const asked = context.messages[0].content as string;
    expect(asked).toContain("The task:\nfix the tests");
    expect(asked).not.toContain("file text");
    expect(asked).toContain("] Running the sidecar tests");
    expect(asked).not.toContain("Not a procedure");
    expect(options).toMatchObject({ cacheRetention: "none" });
  });

  it("offers nothing without procedures (asking no model), when none fits, or once aborted", async () => {
    const none = session("NONE");
    expect(await procedureNote(none, "/work/app", "fix", live(), db)).toBe("");
    expect(none.modelRuntime.completeSimple).not.toHaveBeenCalled();
    addMemories(db, [memory({ title: "Running", concepts: [PROCEDURE] })]);
    expect(await procedureNote(none, "/work/app", "fix", live(), db)).toBe("");
    const stopped = new AbortController();
    const picks = session(`${firstId(db)}`);
    const note = procedureNote(picks, "/work/app", "fix", stopped.signal, db);
    stopped.abort();
    expect(await note).toBe("");
  });
});

describe("pickFor", () => {
  beforeEach(() => {
    addMemories(db, [memory({ title: "Running", concepts: [PROCEDURE] })]);
  });
  const setup = (
    over: { messages?: AgentMessage[]; routing?: object } = {},
  ) => {
    const agent = { cwd: "/work/app", ...over } as unknown as Agent;
    const s = {
      ...session(`${firstId(db)}`),
      messages: over.messages ?? [],
      isStreaming: true,
      sendCustomMessage: vi.fn(async () => {}),
    };
    return { agent, s, pick: () => pickFor(agent, s, "run the tests", db) };
  };

  it("steers the note into the run the message started", async () => {
    const { agent, s, pick } = setup();
    const picking = pick()!;
    expect(agent.picking).toBeDefined();
    await picking.ran("started");
    expect(s.sendCustomMessage).toHaveBeenCalledWith(
      {
        customType: PROCEDURE,
        content: expect.stringContaining("] Running"),
        display: false,
      },
      { deliverAs: "steer" },
    );
    expect(agent.picking).toBeUndefined();
  });

  it("picks nothing past the first message or while one is routed", () => {
    expect(setup({ messages: [user] }).pick()).toBeUndefined();
    expect(setup({ routing: {} }).pick()).toBeUndefined();
  });

  it.each(["handled", "queued"])(
    "drops the note when pi %s the message instead of starting a run",
    async (how) => {
      const { s, pick } = setup();
      await pick()!.ran(how);
      expect(s.sendCustomMessage).not.toHaveBeenCalled();
    },
  );

  it("drops the note after Stop, cancel, the run's end, or a later message", async () => {
    const stopped = setup();
    const a = stopped.pick()!;
    stopped.agent.picking!.abort();
    await a.ran("started");
    const cancelled = setup();
    const b = cancelled.pick()!;
    b.cancel();
    await b.ran("started");
    const ended = setup();
    const c = ended.pick()!;
    ended.s.isStreaming = false;
    await c.ran("started");
    const next = setup();
    const d = next.pick()!;
    next.s.messages.push(user, user);
    await d.ran("started");
    for (const { s } of [stopped, cancelled, ended, next])
      expect(s.sendCustomMessage).not.toHaveBeenCalled();
  });
});
