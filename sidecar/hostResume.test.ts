import { describe, expect, it, vi } from "vitest";
import type { AgentMessage, ToolCall } from "../shared/agentTypes.ts";
import { cutOff, resume } from "./hostResume.ts";
import type { Session } from "./hostTypes.ts";

const call: ToolCall = {
  type: "toolCall",
  id: "t1",
  name: "bash",
  arguments: { command: "git fetch" },
};
const user = { role: "user", content: "hi", timestamp: 1 } as const;
const assistant = (
  stopReason: "toolUse" | "stop" | "aborted",
  content: ToolCall[] = [call],
): AgentMessage => ({
  role: "assistant",
  content,
  provider: "anthropic",
  model: "opus",
  stopReason,
  timestamp: 2,
});
const result: AgentMessage = {
  role: "toolResult",
  toolCallId: "t1",
  toolName: "bash",
  content: [],
  isError: false,
  timestamp: 3,
};

describe("cutOff", () => {
  it("finds tool calls left without results", () => {
    expect(cutOff([user, assistant("toolUse")])).toEqual([call]);
  });

  it("sees a run cut off before the model answered", () => {
    expect(cutOff([user])).toEqual([]);
    expect(cutOff([user, assistant("toolUse"), result])).toEqual([]);
  });

  it("leaves finished, stopped and empty conversations alone", () => {
    expect(cutOff([])).toBeNull();
    expect(cutOff([user, assistant("stop", [])])).toBeNull();
    expect(cutOff([user, assistant("aborted")])).toBeNull();
    expect(cutOff([user, { role: "custom", timestamp: 3 }])).toBeNull();
  });
});

function fakeSession(messages: AgentMessage[], isStreaming = false) {
  return {
    messages,
    isStreaming,
    agent: { state: { messages } },
    sessionManager: { appendMessage: vi.fn(() => "entry") },
    sendCustomMessage: vi.fn(async () => {}),
    prompt: vi.fn(async () => {}),
  } as unknown as Session & {
    sessionManager: { appendMessage: ReturnType<typeof vi.fn> };
    sendCustomMessage: ReturnType<typeof vi.fn>;
    prompt: ReturnType<typeof vi.fn>;
  };
}

describe("resume", () => {
  it("records pending calls as not run and continues the run", async () => {
    const s = fakeSession([user, assistant("toolUse")]);
    await resume(s);
    const notRun = expect.objectContaining({
      role: "toolResult",
      toolCallId: "t1",
      toolName: "bash",
      isError: true,
    });
    expect(s.sessionManager.appendMessage).toHaveBeenCalledWith(notRun);
    expect(s.agent.state.messages.at(-1)).toEqual(notRun);
    expect(s.sendCustomMessage).toHaveBeenCalledWith(
      expect.objectContaining({ display: false }),
      { deliverAs: "nextTurn" },
    );
    expect(s.prompt).toHaveBeenCalledWith("Continue", {});
  });

  it("does nothing for a finished conversation or a running one", async () => {
    const done = fakeSession([user, assistant("stop", [])]);
    const running = fakeSession([user], true);
    await resume(done);
    await resume(running);
    expect(done.sendCustomMessage).not.toHaveBeenCalled();
    expect(running.sendCustomMessage).not.toHaveBeenCalled();
    expect(done.prompt).not.toHaveBeenCalled();
  });
});
