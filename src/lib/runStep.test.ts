import { describe, expect, it } from "vitest";
import type { AgentMessage, AssistantMessage } from "../../shared/agentTypes";
import { currentStep, elapsed, runStart } from "./runStep";

const assistant = (content: AssistantMessage["content"]): AgentMessage => ({
  role: "assistant",
  content,
  provider: "p",
  model: "m",
  stopReason: "pending",
  timestamp: 2,
});
const call = (id: string, name: string, args = {}) =>
  ({ type: "toolCall", id, name, arguments: args }) as const;
const user: AgentMessage = { role: "user", content: "hi", timestamp: 5 };

describe("currentStep", () => {
  it("works with no assistant message", () => {
    expect(currentStep([user], {}, "/w")).toBe("Working");
  });

  it("names a call that has no run yet", () => {
    const m = [assistant([call("a", "edit", { path: "/w/x.ts" })])];
    expect(currentStep(m, {}, "/w")).toBe("Editing x.ts");
  });

  it("names the last running call, skipping finished ones", () => {
    const m = [
      assistant([
        call("a", "read", { path: "a.ts" }),
        call("b", "grep"),
        call("c", "write", { path: "c.ts" }),
      ]),
    ];
    const tools = {
      a: { status: "running" },
      b: { status: "running" },
      c: { status: "done" },
    } as const;
    expect(currentStep(m, tools, "/w")).toBe("Searching the code");
  });

  it("falls back to Working when the step is unnamed", () => {
    const m = [assistant([call("a", "ask_user")])];
    expect(currentStep(m, {}, "/w")).toBe("Working");
  });

  it("says Thinking after a thinking block", () => {
    const m = [
      assistant([
        call("a", "read", { path: "a" }),
        { type: "thinking", thinking: "..." },
      ]),
    ];
    expect(currentStep(m, { a: { status: "done" } }, "/w")).toBe("Thinking");
  });

  it("says Working otherwise", () => {
    const m = [assistant([{ type: "text", text: "hi" }])];
    expect(currentStep(m, {}, "/w")).toBe("Working");
  });
});

describe("runStart", () => {
  it("is the last user message's time", () => {
    const later: AgentMessage = { ...user, timestamp: 9 };
    expect(runStart([user, assistant([]), later])).toBe(9);
  });

  it("is undefined without one", () => {
    expect(runStart([assistant([])])).toBeUndefined();
  });
});

describe("elapsed", () => {
  it.each([
    [0, "0s"],
    [59_999, "59s"],
    [60_000, "1m 0s"],
    [725_000, "12m 5s"],
    [-5, "0s"],
  ])("%i → %s", (ms, text) => {
    expect(elapsed(ms)).toBe(text);
  });
});
