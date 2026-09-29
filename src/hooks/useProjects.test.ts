import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HostMessage } from "../../shared/hostProtocol";
import type { HostClient } from "@/lib/piHost";
import { byFolder, useProjects } from "./useProjects";

function fakeHost() {
  const listeners = new Set<(m: HostMessage) => void>();
  const host = {
    request: vi.fn(async () => undefined) as unknown as HostClient["request"],
    send: vi.fn(async () => {}),
    subscribe: (cb: (m: HostMessage) => void) => {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
    close: vi.fn(),
  } satisfies HostClient;
  const emit = (m: HostMessage) => act(() => listeners.forEach((cb) => cb(m)));
  return Object.assign(host, { emit });
}

const a = { cwd: "/a", running: true, waiting: false };
const b = { cwd: "/b", running: false, waiting: true };
const agents = [
  { ...a, session: "a1", title: "" },
  { ...b, session: "b1", title: "" },
];

describe("useProjects", () => {
  it("reports what each open project is doing", () => {
    const host = fakeHost();
    const { result } = renderHook(() => useProjects(host, ["/a", "/b"]));
    expect(result.current.statuses).toEqual({});
    host.emit({ type: "agents", agents });
    expect(result.current.statuses).toEqual({ "/a": a, "/b": b });
    expect(result.current.agents).toEqual(agents);
  });

  it("ends the session of a project closed in the app", () => {
    const host = fakeHost();
    const { rerender } = renderHook(({ open }) => useProjects(host, open), {
      initialProps: { open: ["/a", "/b"] },
    });
    host.emit({ type: "agents", agents });
    expect(host.request).not.toHaveBeenCalled();
    rerender({ open: ["/b"] });
    expect(host.request).toHaveBeenCalledExactlyOnceWith({
      type: "close_session",
      cwd: "/a",
    });
  });

  it("drops statuses from a host that was replaced", () => {
    const first = fakeHost();
    const { result, rerender } = renderHook(
      ({ host }) => useProjects(host, ["/a"]),
      { initialProps: { host: first as HostClient | null } },
    );
    first.emit({ type: "agents", agents: [agents[0]] });
    rerender({ host: null });
    expect(result.current).toEqual({ statuses: {}, agents: [] });
  });
});

describe("byFolder", () => {
  it("shows a folder working or waiting if any of its conversations is", () => {
    const [x, y] = [
      { cwd: "/a", session: "1", title: "", running: true, waiting: false },
      { cwd: "/a", session: "2", title: "", running: false, waiting: true },
    ];
    expect(byFolder([x, y])).toEqual({
      "/a": { cwd: "/a", running: true, waiting: true },
    });
    expect(byFolder([y, x])).toEqual(byFolder([x, y]));
  });
});
