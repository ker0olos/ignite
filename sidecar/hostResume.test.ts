import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentMessage, ToolCall } from "../shared/agentTypes.ts";
import {
  cutOff,
  INTERRUPTED,
  plan,
  prepareResume,
  UNASKED_OUTSIDE,
} from "./hostResume.ts";
import type { Session } from "./hostTypes.ts";
import { markWaiting, readWaiting } from "./waitingCalls.ts";

const call = (id: string, name = "bash"): ToolCall => ({
  type: "toolCall",
  id,
  name,
  arguments: { command: "git fetch" },
});
const t1 = call("t1");
const t2 = call("t2", "ask_user");
const user = { role: "user", content: "hi", timestamp: 1 } as const;
const assistant = (
  stopReason: "toolUse" | "stop" | "aborted",
  content: ToolCall[] = [t1],
): AgentMessage => ({
  role: "assistant",
  content,
  provider: "anthropic",
  model: "opus",
  stopReason,
  timestamp: 2,
});
const result = (toolCallId = "t1", text = "fetched"): AgentMessage => ({
  role: "toolResult",
  toolCallId,
  toolName: "bash",
  content: [{ type: "text", text }],
  isError: false,
  timestamp: 3,
});

describe("cutOff", () => {
  it("finds tool calls left without results", () => {
    const message = assistant("toolUse");
    expect(cutOff([user, message])).toEqual({ message, calls: [t1] });
  });

  it("finds the calls a sequential run hadn't reached", () => {
    const message = assistant("toolUse", [t1, t2]);
    expect(cutOff([user, message, result()])).toEqual({ message, calls: [t2] });
  });

  it("sees a run cut off before the model answered", () => {
    expect(cutOff([user])).toEqual({ calls: [] });
    expect(cutOff([user, assistant("toolUse"), result()])).toEqual({
      calls: [],
    });
  });

  it("leaves finished, stopped and empty conversations alone", () => {
    expect(cutOff([])).toBeNull();
    expect(cutOff([user, assistant("stop", [])])).toBeNull();
    expect(cutOff([user, assistant("aborted")])).toBeNull();
    expect(cutOff([user, { role: "custom", timestamp: 3 }])).toBeNull();
  });
});

describe("plan", () => {
  it("records calls as interrupted when none waited on the user", () => {
    const p = plan([user, assistant("toolUse", [t1, t2])], {});
    expect(p?.replay).toBeUndefined();
    expect(p?.results.map((r) => [r.toolCallId, r.content])).toEqual([
      ["t1", [{ type: "text", text: INTERRUPTED }]],
      ["t2", [{ type: "text", text: INTERRUPTED }]],
    ]);
  });

  it("never runs again a command that ran in the sandbox before it asked", () => {
    const p = plan([user, assistant("toolUse", [t1, t2])], { t1: "ran" });
    expect(p?.replay).toBeUndefined();
    expect(p?.results.map((r) => r.content)).toEqual([
      [{ type: "text", text: UNASKED_OUTSIDE }],
      [{ type: "text", text: INTERRUPTED }],
    ]);
  });

  it("runs every call again when one waited before running", () => {
    const message = assistant("toolUse", [t1, t2]);
    const p = plan([user, message], { t2: "before" });
    expect(p).toEqual({ results: [], replay: message, blocked: new Map() });
  });

  it("keeps a sequential run's finished calls as they ended", () => {
    const message = assistant("toolUse", [t1, t2]);
    const p = plan([user, message, result()], { t2: "before" });
    expect(p?.blocked.get("t1")).toMatch(/^Finished before .*\nfetched$/);
  });

  it("blocks the calls that may have run beside one asking while it runs", () => {
    const t3 = call("t3");
    const message = assistant("toolUse", [t1, t2, t3]);
    const p = plan([user, message], { t2: "asking", t3: "ran" });
    expect(p?.blocked).toEqual(
      new Map([
        ["t1", INTERRUPTED],
        ["t3", UNASKED_OUTSIDE],
      ]),
    );
  });

  it("has nothing to resume in a finished conversation", () => {
    expect(plan([user, assistant("stop", [])], { t1: "before" })).toBeNull();
  });
});

type Fake = Session & {
  sessionManager: {
    appendMessage: ReturnType<
      typeof vi.fn<
        (r: { toolCallId: string; content: { text: string }[] }) => string
      >
    >;
  };
  listeners: ((e: { type: string }) => void)[];
  sendCustomMessage: ReturnType<typeof vi.fn>;
  prompt: ReturnType<typeof vi.fn>;
};

function fakeSession(messages: AgentMessage[], isStreaming = false) {
  const before = vi.fn(async () => undefined);
  const stream = vi.fn(() => "streamed");
  const s = {
    messages,
    isStreaming,
    agent: {
      state: { messages },
      streamFunction: stream,
      beforeToolCall: before,
    },
    refreshContext: vi.fn(),
    sessionManager: {
      appendMessage: vi.fn(() => "entry"),
      getBranch: () => [
        { type: "message", parentId: null, message: user },
        { type: "message", parentId: "u1", message: messages.at(-1) },
      ],
      branch: vi.fn(),
      resetLeaf: vi.fn(),
      getSessionId: () => "s1",
      getLeafId: () => "a1",
    },
    sendCustomMessage: vi.fn(async () => {}),
    prompt: vi.fn(async () => {}),
    listeners: [] as ((e: { type: string }) => void)[],
    subscribe(listener: (e: { type: string }) => void) {
      s.listeners.push(listener);
      return () => s.listeners.splice(s.listeners.indexOf(listener), 1);
    },
  };
  return { s: s as unknown as Fake, before, stream };
}

describe("prepareResume", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "resume-"));
    process.env.PI_CODING_AGENT_DIR = dir;
  });
  afterEach(() => {
    delete process.env.PI_CODING_AGENT_DIR;
    rmSync(dir, { recursive: true, force: true });
  });

  it("records interrupted calls before the app reads the conversation, then continues", async () => {
    const { s } = fakeSession([user, assistant("toolUse")]);
    const resume = prepareResume(s);
    const interrupted = expect.objectContaining({
      role: "toolResult",
      toolCallId: "t1",
      isError: true,
    });
    expect(s.sessionManager.appendMessage).toHaveBeenCalledWith(interrupted);
    expect(s.refreshContext).toHaveBeenCalled();
    expect(s.prompt).not.toHaveBeenCalled();
    await resume!.begin();
    await resume!.started;
    expect(s.sendCustomMessage).toHaveBeenCalledWith(
      expect.objectContaining({ display: false }),
      { deliverAs: "nextTurn" },
    );
    expect(s.prompt).toHaveBeenCalledWith("Continue", {});
  });

  it("runs a waiting call's message again, so it asks as before", async () => {
    const message = assistant("toolUse", [t1, t2]);
    const { s, before, stream } = fakeSession([user, message]);
    markWaiting("s1", "t2", "asking");
    const resume = prepareResume(s);
    expect(s.sessionManager.branch).toHaveBeenCalledWith("u1");
    expect(s.sessionManager.appendMessage).not.toHaveBeenCalled();
    expect(readWaiting("s1")).toEqual({});

    let replayed: unknown[] = [];
    let blocked: unknown;
    let passed: unknown;
    s.prompt.mockImplementation(async () => {
      const call = s.agent.streamFunction as unknown as (
        ...a: unknown[]
      ) => AsyncIterable<unknown>;
      // A compaction's call goes to the model as usual.
      expect(call("m", { messages: [user] })).toBe("streamed");
      const note = {
        role: "user",
        content: [
          { type: "text", text: s.sendCustomMessage.mock.calls[0][0].content },
        ],
      };
      // An earlier resume's note, before the last assistant message, doesn't count.
      expect(call("m", { messages: [note, message, user] })).toBe("streamed");
      const events = call("m", { messages: [message, user, note, user] });
      replayed = [];
      for await (const e of events) replayed.push(e);
      const hook = s.agent.beforeToolCall!;
      blocked = await hook({ toolCall: { id: "t1" } });
      passed = await hook({ toolCall: { id: "t2" } });
    });
    await resume!.begin();
    expect(stream).toHaveBeenCalledTimes(2);
    expect(replayed).toEqual([
      expect.objectContaining({ type: "start" }),
      {
        type: "done",
        reason: "toolUse",
        message: expect.objectContaining({ content: [t1, t2] }),
      },
    ]);
    expect(blocked).toEqual({ block: true, reason: INTERRUPTED });
    expect(passed).toBeUndefined();
    expect(before).toHaveBeenCalledOnce();
    expect(s.agent.streamFunction).toBe(stream);
    expect(s.agent.beforeToolCall).toBe(before);
  });

  it("puts the message back with its calls ended when the user writes first", async () => {
    const { s } = fakeSession([user, assistant("toolUse", [t1, t2])]);
    markWaiting("s1", "t2", "asking");
    const resume = prepareResume(s)!;
    expect(await resume.cancel("wrote")).toBe(true);
    expect(s.sessionManager.branch).toHaveBeenLastCalledWith("a1");
    expect(
      s.sessionManager.appendMessage.mock.calls.map(([r]) => [
        r.toolCallId,
        r.content[0].text,
      ]),
    ).toEqual([
      ["t1", INTERRUPTED],
      ["t2", "wrote"],
    ]);
    // The agent still hears its run was cut off, with the user's message.
    expect(s.sendCustomMessage).toHaveBeenCalledOnce();
    await resume.started;
    await resume.begin();
    expect(s.prompt).not.toHaveBeenCalled();
  });

  it("can't be cancelled once begun, and undoes itself if it fails before running", async () => {
    const { s } = fakeSession([user, assistant("toolUse", [t1, t2])]);
    markWaiting("s1", "t2", "before");
    const resume = prepareResume(s)!;
    s.prompt.mockRejectedValue(new Error("No model."));
    const begun = resume.begin();
    expect(await resume.cancel("wrote")).toBe(false);
    await expect(begun).rejects.toThrow("No model.");
    expect(s.sessionManager.branch).toHaveBeenLastCalledWith("a1");
    expect(s.sessionManager.appendMessage).toHaveBeenCalledTimes(2);
  });

  it("settles `started` once the run starts, before it ends", async () => {
    const { s } = fakeSession([user, assistant("toolUse")]);
    const resume = prepareResume(s)!;
    let end = () => {};
    s.prompt.mockImplementation(() => {
      for (const l of [...s.listeners]) l({ type: "agent_start" });
      return new Promise<void>((resolve) => (end = resolve));
    });
    const begun = resume.begin();
    await resume.started;
    end();
    await begun;
    expect(s.listeners).toEqual([]);
  });

  it("does nothing for a finished conversation or a running one", () => {
    expect(
      prepareResume(fakeSession([user, assistant("stop", [])]).s),
    ).toBeNull();
    expect(prepareResume(fakeSession([user], true).s)).toBeNull();
  });
});
