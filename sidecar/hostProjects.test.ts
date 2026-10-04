import { describe, expect, it, vi } from "vitest";
import { pushProjects } from "./hostProjects.ts";
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
