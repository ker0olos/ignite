// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentMessage } from "../shared/agentTypes.ts";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import {
  dropFork,
  forkOf,
  forkSession,
  noteFor,
  summarize,
  takeNotes,
  unreported,
} from "./forks.ts";
import type { Session } from "./hostTypes.ts";
import { sessionFor } from "./sessionStore.ts";

let agentDir: string;
const cwd = "/work";

beforeEach(() => {
  agentDir = mkdtempSync(join(tmpdir(), "forks-"));
  process.env.PI_CODING_AGENT_DIR = agentDir;
});

afterEach(() => {
  delete process.env.PI_CODING_AGENT_DIR;
  rmSync(agentDir, { recursive: true, force: true });
  takeNotes("first");
});

const usage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

const reply = (text: string) => ({
  role: "assistant" as const,
  content: [{ type: "text" as const, text }],
  api: "x",
  provider: "x",
  model: "x",
  usage,
  stopReason: "stop" as const,
  timestamp: 1,
});

const say = (
  s: ReturnType<typeof sessionFor>,
  text: string,
  answer: string,
) => {
  s.appendMessage({ role: "user", content: text, timestamp: 1 });
  s.appendMessage(reply(answer));
};

// No priced model, so summaries fall back to the last reply.
const unpriced = {
  model: undefined,
  modelRuntime: {} as Session["modelRuntime"],
};

describe("forks", () => {
  it("copies a conversation under a new id and name, told it's a fork", () => {
    say(sessionFor(cwd, cwd, "first"), "plan it", "planned");
    forkSession(cwd, "first", "copy", "run the benchmarks");
    const fork = sessionFor(cwd, cwd, "copy");
    expect(fork.getSessionName()).toBe("run the benchmarks");
    const messages = fork.buildSessionContext().messages;
    expect(messages.map((m) => m.role)).toEqual([
      "user",
      "assistant",
      "custom",
    ]);
    expect(unreported({ sessionManager: fork })).toBeNull();
  });

  it("refuses to fork a conversation with nothing saved", () => {
    expect(() => forkSession(cwd, "missing", "copy", "x")).toThrow(
      "nothing to fork",
    );
  });

  it("reports only what the fork did since its last report", () => {
    say(sessionFor(cwd, cwd, "first"), "plan it", "planned");
    forkSession(cwd, "first", "copy", "bench");
    const fork = sessionFor(cwd, cwd, "copy");
    const s = { sessionManager: fork };
    say(fork, "run them", "2x faster");
    const found = unreported(s);
    expect(found?.parent).toBe("first");
    expect(found?.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(unreported(s)).toBeNull();
    say(fork, "again", "3x faster");
    expect(unreported(s)?.messages).toHaveLength(2);
  });

  it("summarizes with the last reply when no model can", async () => {
    const messages = [reply("all green")] as AgentMessage[];
    expect(await summarize(unpriced, messages)).toBe("all green");
  });

  it("summarizes with the last reply when the model call fails", async () => {
    const model = {
      provider: "x",
      id: "cheap",
      name: "Cheap",
      cost: { output: 1 },
    };
    const s = {
      model,
      modelRuntime: {
        getModels: () => [model],
        getAvailable: async () => [model],
        completeSimple: vi.fn(async () => {
          throw new Error("timed out");
        }),
      } as unknown as Session["modelRuntime"],
    };
    const messages = [reply("all green")] as AgentMessage[];
    expect(await summarize(s, messages)).toBe("all green");
    expect(s.modelRuntime.completeSimple).toHaveBeenCalled();
  });

  it("deletes a fork that failed to start", () => {
    say(sessionFor(cwd, cwd, "first"), "plan it", "planned");
    forkSession(cwd, "first", "copy", "bench");
    dropFork(cwd, "copy");
    expect(SessionManager.findById(cwd, "copy")).toBeUndefined();
    expect(SessionManager.findById(cwd, "first")).toBeTruthy();
  });

  it("knows a fork's original", () => {
    say(sessionFor(cwd, cwd, "first"), "plan it", "planned");
    forkSession(cwd, "first", "copy", "bench");
    expect(forkOf(sessionFor(cwd, cwd, "copy"))).toBe("first");
    expect(forkOf(sessionFor(cwd, cwd, "first"))).toBeUndefined();
  });

  it("delivers a note with the conversation's next run", async () => {
    noteFor("first", "Your fork is done: 2x faster");
    // pi loads each extension with its own copy of the modules it imports.
    vi.resetModules();
    const { default: forkExtension } = await import("./forkExtension.ts");
    const on = vi.fn();
    forkExtension({ on } as never);
    const [, handler] = on.mock.calls[0];
    const ctx = (id: string) => ({
      sessionManager: { getSessionId: () => id },
    });
    const result = handler({}, ctx("first"));
    expect(result.message.content).toBe("Your fork is done: 2x faster");
    expect(handler({}, ctx("first"))).toBeUndefined();
  });

  it("joins several notes for one run", () => {
    noteFor("first", "one");
    noteFor("first", "two");
    expect(takeNotes("first")).toEqual(["one", "two"]);
    expect(takeNotes("first")).toEqual([]);
  });
});
