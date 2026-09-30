import { describe, expect, it, vi } from "vitest";
import { firstTitle, pushProjects, titleOf } from "./hostProjects.ts";
import type { AgentMessage } from "../shared/agentTypes.ts";
import type { Agent, HostContext } from "./hostTypes.ts";

const agent = (running: boolean, waiting: boolean, ...requests: object[]) =>
  ({
    running,
    approvals: new Map(
      (waiting && !requests.length ? [{ toolCallId: "t1" }] : requests).map(
        (request, i) => [`t${i}`, { request }],
      ),
    ),
  }) as unknown as Agent;

const pushed = (agents: Record<string, Agent>) => {
  const keepAwake = vi.fn(async () => {});
  const send = vi.fn();
  const ctx = {
    send,
    agents: new Map(Object.entries(agents)),
    keepAwake,
  } as unknown as HostContext;
  pushProjects(ctx);
  return { awake: keepAwake.mock.calls[0], message: send.mock.calls[0][0] };
};

const push = (agents: Record<string, Agent>) => pushed(agents).awake;

describe("pushProjects", () => {
  it("passes on a waiting pull request's review, and no other call's", () => {
    const pr = { toolCallId: "p", review: { kind: "pr" } };
    const commit = { toolCallId: "c", review: { kind: "commit" } };
    const [withPr, without] = pushed({
      a: agent(true, true, commit, pr),
      b: agent(true, true, commit),
    }).message.agents;
    expect(withPr.review).toEqual(pr);
    expect(without).not.toHaveProperty("review");
  });

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
