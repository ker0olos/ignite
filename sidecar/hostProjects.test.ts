import { describe, expect, it, vi } from "vitest";
import { pushProjects } from "./hostProjects.ts";
import type { HostContext, Project } from "./hostTypes.ts";

const project = (running: boolean, waiting: boolean) =>
  ({
    running,
    approvals: new Map(waiting ? [["t1", {}]] : []),
  }) as unknown as Project;

const push = (projects: Record<string, Project>) => {
  const keepAwake = vi.fn(async () => {});
  const ctx = {
    send: vi.fn(),
    projects: new Map(Object.entries(projects)),
    keepAwake,
  } as unknown as HostContext;
  pushProjects(ctx);
  return keepAwake.mock.calls[0];
};

describe("pushProjects", () => {
  it("keeps the Mac awake only while some agent works, not while it waits", () => {
    expect(push({ "/a": project(true, false) })).toEqual([true]);
    expect(push({ "/a": project(true, true) })).toEqual([false]);
    expect(push({ "/a": project(false, false) })).toEqual([false]);
    expect(
      push({ "/a": project(true, true), "/b": project(true, false) }),
    ).toEqual([true]);
  });
});
