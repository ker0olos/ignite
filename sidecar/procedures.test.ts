// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentMessage } from "../shared/agentTypes.ts";
import { CODEMODE_TOOL } from "../shared/codemode.ts";
import { LESSON_ADD_TOOL } from "../shared/lessons.ts";
import { PROCEDURE } from "../shared/memory.ts";
import type { Session } from "./hostTypes.ts";
import { addMemories, memoryDb } from "./memoryDb.ts";
import {
  learnsProcedures,
  offer,
  pickedFrom,
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
  it("keeps the listed procedures the reply names, at most 3", () => {
    const listed = [1, 2, 3, 4].map((id) => ({ id }) as never);
    expect(pickedFrom("NONE", listed)).toEqual([]);
    expect(pickedFrom("2, 9", listed)).toEqual([{ id: 2 }]);
    expect(pickedFrom("1,2,3,4", listed)).toHaveLength(3);
  });
});

describe("procedureNote", () => {
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
  const session = (reply: string, messages: AgentMessage[] = []) => ({
    model,
    messages,
    modelRuntime: {
      getModels: () => [model],
      getAvailable: async () => [model],
      completeSimple: vi.fn(async () => ({
        content: [{ type: "text", text: reply }],
        stopReason: "stop",
      })),
    } as unknown as Session["modelRuntime"],
  });
  const agent = { cwd: "/work/app" };

  it("offers the procedures the cheapest model picks for the first message", async () => {
    addMemories(db, [
      memory({
        title: "Running the sidecar tests",
        facts: ["Run pnpm install first"],
        concepts: [PROCEDURE],
      }),
      memory({ title: "Not a procedure" }),
    ]);
    const [first] = db.prepare("SELECT id FROM memories").all() as {
      id: number;
    }[];
    const s = session(`${first.id}`);
    const note = await procedureNote(agent, s, "fix the tests", db);
    expect(note).toMatch(/^Procedures earlier conversations/);
    expect(note).toContain(
      "] Running the sidecar tests\n- Run pnpm install first",
    );
    const [, context] = vi.mocked(s.modelRuntime.completeSimple).mock.calls[0];
    const asked = context.messages[0].content as string;
    expect(asked).toContain("The task:\nfix the tests");
    expect(asked).toContain("] Running the sidecar tests");
    expect(asked).not.toContain("Not a procedure");
  });

  it("offers nothing past the first message, without procedures, or when none fits", async () => {
    const none = session("NONE");
    expect(await procedureNote(agent, none, "fix", db)).toBe("");
    // No procedures: the model isn't asked.
    expect(none.modelRuntime.completeSimple).not.toHaveBeenCalled();
    addMemories(db, [memory({ title: "Running", concepts: [PROCEDURE] })]);
    expect(await procedureNote(agent, none, "fix", db)).toBe("");
    const later = session("1", [
      { role: "user", content: "hi", timestamp: 1 } as AgentMessage,
    ]);
    expect(await procedureNote(agent, later, "fix", db)).toBe("");
    expect(later.modelRuntime.completeSimple).not.toHaveBeenCalled();
  });
});

describe("offer", () => {
  it("adds the note to the next run, hidden; nothing without one", async () => {
    const sendCustomMessage = vi.fn(async () => {});
    await offer({ sendCustomMessage }, "");
    expect(sendCustomMessage).not.toHaveBeenCalled();
    await offer({ sendCustomMessage }, "note");
    expect(sendCustomMessage).toHaveBeenCalledWith(
      { customType: PROCEDURE, content: "note", display: false },
      { deliverAs: "nextTurn" },
    );
  });
});
