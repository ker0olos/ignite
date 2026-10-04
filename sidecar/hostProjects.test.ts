import { describe, expect, it, vi } from "vitest";
import { pushProjects, trackRun } from "./hostProjects.ts";
import type { SessionEvent } from "../shared/agentTypes.ts";
import type { Agent, HostContext } from "./hostTypes.ts";

const agent = (running: boolean, waiting: boolean, ...requests: object[]) =>
  ({
    running,
    subagents: new Map(),
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

  it("lists a conversation's subagents once it has some", () => {
    const helper = { id: "agent-1", model: "haiku", running: true };
    const a = agent(true, false);
    a.subagents.set(helper.id, helper);
    const [listed, plain] = pushed({ a, b: agent(true, false) }).message.agents;
    expect(listed.subagents).toEqual([helper]);
    expect(plain).not.toHaveProperty("subagents");
    expect(plain).not.toHaveProperty("background");
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

const reply = (stopReason: string) =>
  ({
    type: "message_end",
    message: { role: "assistant", content: [], stopReason },
  }) as unknown as SessionEvent;

describe("trackRun", () => {
  it("follows a run starting and settling", () => {
    const agent = { running: false } as Agent;
    expect(trackRun(agent, { type: "agent_start" } as SessionEvent)).toBe(true);
    expect(agent.running).toBe(true);
    expect(trackRun(agent, { type: "agent_settled" } as SessionEvent)).toBe(
      true,
    );
    expect(agent.running).toBe(false);
  });

  it("remembers whether the last reply ended in an error", () => {
    const agent = { running: true } as Agent;
    expect(trackRun(agent, reply("error"))).toBe(false);
    expect(agent.failed).toBe(true);
    trackRun(agent, reply("stop"));
    expect(agent.failed).toBe(false);
  });

  it("ignores the user's messages and other events", () => {
    const agent = { running: true, failed: true } as Agent;
    const user = {
      type: "message_end",
      message: { role: "user", content: "hi" },
    } as unknown as SessionEvent;
    expect(trackRun(agent, user)).toBe(false);
    expect(agent).toEqual({ running: true, failed: true });
  });
});
