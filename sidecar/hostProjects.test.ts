import { describe, expect, it, vi } from "vitest";
import { firstTitle, pushProjects, titleOf } from "./hostProjects.ts";
import type { AgentMessage } from "../shared/agentTypes.ts";
import type { Agent, HostContext } from "./hostTypes.ts";

const agent = (running: boolean, waiting: boolean) =>
  ({
    running,
    approvals: new Map(waiting ? [["t1", {}]] : []),
  }) as unknown as Agent;

const push = (agents: Record<string, Agent>) => {
  const keepAwake = vi.fn(async () => {});
  const ctx = {
    send: vi.fn(),
    agents: new Map(Object.entries(agents)),
    keepAwake,
  } as unknown as HostContext;
  pushProjects(ctx);
  return keepAwake.mock.calls[0];
};

describe("pushProjects", () => {
  it("keeps the Mac awake only while some agent works, not while it waits", () => {
    expect(push({ "/a": agent(true, false) })).toEqual([true]);
    expect(push({ "/a": agent(true, true) })).toEqual([false]);
    expect(push({ "/a": agent(false, false) })).toEqual([false]);
    expect(push({ "/a": agent(true, true), "/b": agent(true, false) })).toEqual(
      [true],
    );
  });
});

describe("firstTitle", () => {
  it("names a conversation after the first line of its first message", () => {
    expect(
      firstTitle([
        { role: "assistant", content: [] } as unknown as AgentMessage,
        { role: "user", content: "  Fix login\nsecond line", timestamp: 1 },
        { role: "user", content: "later", timestamp: 2 },
      ]),
    ).toBe("Fix login");
    expect(
      firstTitle([
        {
          role: "user",
          content: [
            { type: "image", data: "", mimeType: "image/png" },
            { type: "text", text: "What's this?" },
          ],
          timestamp: 1,
        },
      ]),
    ).toBe("What's this?");
    expect(
      firstTitle([{ role: "user", content: "x".repeat(200), timestamp: 1 }]),
    ).toHaveLength(80);
  });

  it("leaves a conversation with no message untitled", () => {
    expect(firstTitle([])).toBe("");
    expect(titleOf(undefined)).toBe("");
  });
});
