import { describe, expect, it } from "vitest";
import type {
  AgentMessage,
  AssistantMessage,
  SessionEvent,
  ToolCall,
} from "../../shared/agentTypes";
import {
  EMPTY,
  applyError,
  applyEvent,
  fromHistory,
  requestApproval,
  settleApproval,
  type Transcript,
} from "./transcript";

const user: AgentMessage = { role: "user", content: "Fix it", timestamp: 1 };
const assistant = (
  content: AssistantMessage["content"] = [],
): AssistantMessage => ({
  role: "assistant",
  content,
  provider: "anthropic",
  model: "opus",
  stopReason: "pending",
  timestamp: 2,
});
const call: ToolCall = {
  type: "toolCall",
  id: "c1",
  name: "bash",
  arguments: { command: "ls" },
};
const output = { content: [{ type: "text" as const, text: "a.txt" }] };

const run = (events: SessionEvent[], from: Transcript = EMPTY) =>
  events.reduce(applyEvent, from);
const update = (
  assistantMessageEvent: Extract<
    SessionEvent,
    { type: "message_update" }
  >["assistantMessageEvent"],
): SessionEvent => ({ type: "message_update", assistantMessageEvent });
const lastMessage = (t: Transcript) => {
  const item = t.items.at(-1);
  return item?.kind === "message" ? item.message : undefined;
};

describe("applyEvent", () => {
  it("tracks whether pi is running", () => {
    const started = run([{ type: "agent_start" }]);
    expect(started.running).toBe(true);
    // agent_end isn't the end: retries or queued work can follow.
    expect(
      run([{ type: "agent_end", willRetry: false }], started).running,
    ).toBe(true);
    expect(run([{ type: "agent_settled" }], started).running).toBe(false);
  });

  it("adds messages as they start and replaces them when they end", () => {
    const final = {
      ...assistant([{ type: "text", text: "Done." }]),
      stopReason: "stop" as const,
    };
    const t = run([
      { type: "message_start", message: user },
      { type: "message_end", message: user },
      { type: "message_start", message: assistant() },
      { type: "message_end", message: final },
    ]);
    expect(t.items).toEqual([
      { kind: "message", message: user },
      { kind: "message", message: final },
    ]);
  });

  it("adds a message that ends without having started", () => {
    expect(run([{ type: "message_end", message: user }]).items).toEqual([
      { kind: "message", message: user },
    ]);
  });

  it("builds text and thinking from deltas, then takes pi's final block", () => {
    const streaming = run([
      { type: "message_start", message: assistant() },
      update({ type: "thinking_start", contentIndex: 0 }),
      update({ type: "thinking_delta", contentIndex: 0, delta: "Hm" }),
      update({ type: "text_start", contentIndex: 1 }),
      update({ type: "text_delta", contentIndex: 1, delta: "Hel" }),
      update({ type: "text_delta", contentIndex: 1, delta: "lo" }),
    ]);
    expect(lastMessage(streaming)).toMatchObject({
      content: [
        { type: "thinking", thinking: "Hm" },
        { type: "text", text: "Hello" },
      ],
    });
    const ended = run(
      [
        update({ type: "thinking_end", contentIndex: 0, content: "Hmm." }),
        update({ type: "text_end", contentIndex: 1, content: "Hello!" }),
      ],
      streaming,
    );
    expect(lastMessage(ended)).toMatchObject({
      content: [
        { type: "thinking", thinking: "Hmm." },
        { type: "text", text: "Hello!" },
      ],
    });
  });

  it("shows a tool call from its start and takes the full call at its end", () => {
    const started = run([
      { type: "message_start", message: assistant() },
      update({
        type: "toolcall_start",
        contentIndex: 0,
        id: "c1",
        toolName: "bash",
      }),
      update({ type: "toolcall_delta", contentIndex: 0, delta: '{"com' }),
    ]);
    expect(lastMessage(started)).toMatchObject({
      content: [{ type: "toolCall", id: "c1", name: "bash", arguments: {} }],
    });
    const ended = run(
      [update({ type: "toolcall_end", contentIndex: 0, toolCall: call })],
      started,
    );
    expect(lastMessage(ended)).toMatchObject({ content: [call] });
  });

  it("waits for a tool call's end when its start has no name", () => {
    const started = run([
      { type: "message_start", message: assistant() },
      update({
        type: "toolcall_start",
        contentIndex: 0,
      } as unknown as Parameters<typeof update>[0]),
    ]);
    expect(lastMessage(started)).toMatchObject({ content: [] });
  });

  it("ignores updates it can't place", () => {
    const noAssistant = run([{ type: "message_start", message: user }]);
    expect(
      run(
        [update({ type: "text_delta", contentIndex: 0, delta: "x" })],
        noAssistant,
      ),
    ).toBe(noAssistant);

    const t = run([{ type: "message_start", message: assistant() }]);
    // Deltas for a block that never started, or of the wrong kind.
    expect(
      run([update({ type: "text_delta", contentIndex: 0, delta: "x" })], t),
    ).toBe(t);
    expect(
      run([update({ type: "thinking_delta", contentIndex: 0, delta: "x" })], t),
    ).toBe(t);
    expect(run([update({ type: "done" })], t)).toBe(t);
  });

  it("follows a tool run from start to result", () => {
    const started = run([
      {
        type: "tool_execution_start",
        toolCallId: "c1",
        toolName: "bash",
        args: {},
      },
    ]);
    expect(started.tools.c1).toEqual({ status: "running" });
    const partial = run(
      [
        {
          type: "tool_execution_update",
          toolCallId: "c1",
          partialResult: output,
        },
      ],
      started,
    );
    expect(partial.tools.c1).toEqual({ status: "running", result: output });
    expect(
      run(
        [
          {
            type: "tool_execution_end",
            toolCallId: "c1",
            result: output,
            isError: false,
          },
        ],
        partial,
      ).tools.c1,
    ).toEqual({ status: "done", result: output });
    expect(
      run(
        [
          {
            type: "tool_execution_end",
            toolCallId: "c1",
            result: output,
            isError: true,
          },
        ],
        partial,
      ).tools.c1.status,
    ).toBe("error");
    expect(
      run(
        [
          {
            type: "tool_execution_end",
            toolCallId: "c1",
            result: { ...output, details: { error: "connect_failed" } },
            isError: false,
          },
        ],
        partial,
      ).tools.c1.status,
    ).toBe("error");
  });

  it("marks a call waiting for approval until it's answered", () => {
    const started = run([
      {
        type: "tool_execution_start",
        toolCallId: "c1",
        toolName: "bash",
        args: {},
      },
    ]);
    const waiting = requestApproval(started, {
      toolCallId: "c1",
      reason: "Pipes text into a shell",
    });
    expect(waiting.tools.c1).toEqual({
      status: "running",
      approval: { reason: "Pipes text into a shell" },
    });
    expect(settleApproval(waiting, "c1").tools.c1.approval).toBeUndefined();
  });

  it("asks without a reason in Manual, even before the call has started", () => {
    expect(requestApproval(EMPTY, { toolCallId: "c9" }).tools.c9).toEqual({
      status: "running",
      approval: {},
    });
  });

  it("keeps a commit or push's review while it waits for approval", () => {
    const review = {
      kind: "commit" as const,
      repo: "/repo",
      range: "staged",
      files: [],
      message: "fix: bug",
    };
    // Its reason would only repeat what the review shows.
    const waiting = requestApproval(EMPTY, {
      toolCallId: "c1",
      reason: "Push",
      review,
    });
    expect(waiting.tools.c1).toEqual({
      status: "running",
      approval: { review },
    });
  });

  it("ignores an answer for a call it doesn't know", () => {
    expect(settleApproval(EMPTY, "nope")).toBe(EMPTY);
  });

  it("stops waiting once the call ends (denied or stopped)", () => {
    const waiting = requestApproval(EMPTY, { toolCallId: "c1" });
    const ended = run(
      [
        {
          type: "tool_execution_end",
          toolCallId: "c1",
          result: output,
          isError: true,
        },
      ],
      waiting,
    );
    expect(ended.tools.c1.approval).toBeUndefined();
  });

  it("settles a tool from its result message", () => {
    const result: AgentMessage = {
      role: "toolResult",
      toolCallId: "c1",
      toolName: "bash",
      ...output,
      details: { truncated: false },
      isError: true,
      timestamp: 3,
    };
    const t = run([
      { type: "message_start", message: result },
      { type: "message_end", message: result },
    ]);
    expect(t.tools.c1).toEqual({
      status: "error",
      result: { ...output, details: { truncated: false } },
    });
  });

  it("notes retries, final failures and compaction", () => {
    const t = run([
      {
        type: "auto_retry_start",
        attempt: 1,
        maxAttempts: 3,
        errorMessage: "529 overloaded",
      },
      { type: "auto_retry_end", success: true },
      { type: "auto_retry_end", success: false, finalError: "Gave up." },
      { type: "auto_retry_end", success: false },
      { type: "compaction_start", reason: "threshold" },
      { type: "compaction_end", aborted: false },
      { type: "compaction_end", aborted: false, errorMessage: "Too big." },
    ]);
    expect(t.items).toEqual([
      { kind: "notice", text: "Retrying (1/3): 529 overloaded" },
      { kind: "notice", text: "Gave up.", error: true },
      { kind: "notice", text: "The request failed.", error: true },
      { kind: "notice", text: "Compacting the conversation" },
      { kind: "notice", text: "Too big.", error: true },
    ]);
  });

  it("ignores events it doesn't show", () => {
    expect(run([{ type: "turn_start" }, { type: "turn_end" }])).toBe(EMPTY);
    expect(applyEvent(EMPTY, { type: "queue_update" } as never)).toBe(EMPTY);
  });
});

describe("applyError", () => {
  it("shows the error without pi's CLI help and ends the run", () => {
    const t = applyError(
      { ...EMPTY, running: true },
      "No API key found for the selected model.\n\nUse /login to log in.",
    );
    expect(t.running).toBe(false);
    expect(t.items).toEqual([
      {
        kind: "notice",
        text: "No API key found for the selected model.",
        error: true,
      },
    ]);
  });
});

describe("fromHistory", () => {
  it("rebuilds messages and tool results from a saved session", () => {
    const result: AgentMessage = {
      role: "toolResult",
      toolCallId: "c1",
      toolName: "bash",
      ...output,
      isError: false,
      timestamp: 3,
    };
    const t = fromHistory([user, assistant([call]), result], true);
    expect(t.items).toHaveLength(3);
    expect(t.tools.c1).toEqual({
      status: "done",
      result: { ...output, details: undefined },
    });
    expect(t.running).toBe(true);
  });
});
