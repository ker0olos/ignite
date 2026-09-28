import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HostMessage } from "../../shared/hostProtocol";
import type { HostClient } from "@/lib/piHost";
import { useProjects } from "./useProjects";

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

describe("useProjects", () => {
  it("reports what each open project is doing", () => {
    const host = fakeHost();
    const { result } = renderHook(() => useProjects(host, ["/a", "/b"]));
    expect(result.current).toEqual({});
    host.emit({ type: "projects", projects: [a, b] });
    expect(result.current).toEqual({ "/a": a, "/b": b });
  });

  it("ends the session of a project closed in the app", () => {
    const host = fakeHost();
    const { rerender } = renderHook(({ open }) => useProjects(host, open), {
      initialProps: { open: ["/a", "/b"] },
    });
    host.emit({ type: "projects", projects: [a, b] });
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
    first.emit({ type: "projects", projects: [a] });
    rerender({ host: null });
    expect(result.current).toEqual({});
  });
});
