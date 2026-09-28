import { describe, expect, it, vi } from "vitest";
import { pushProjects } from "./hostProjects.ts";
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
