import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { MemoryStatus } from "../../shared/memory";
import type { HostClient } from "@/lib/piHost";
import { useMemory } from "./useMemory";

const RUNNING: MemoryStatus = { counts: {}, observations: [] };

function fakeHost(answer: () => Promise<unknown>) {
  return {
    request: vi.fn(answer) as unknown as HostClient["request"],
    send: vi.fn(),
    subscribe: () => () => {},
    close: vi.fn(),
  } satisfies HostClient;
}

it("asks only while watching, for the open folder", async () => {
  const host = fakeHost(async () => RUNNING);
  const { result, rerender } = renderHook(
    ({ watching }) => useMemory(host, "/work/app", watching),
    { initialProps: { watching: false } },
  );
  expect(host.request).not.toHaveBeenCalled();
  rerender({ watching: true });
  await waitFor(() => expect(result.current.status).toEqual(RUNNING));
  expect(host.request).toHaveBeenCalledWith({
    type: "memory_status",
    cwd: "/work/app",
  });
});

it("asks without a folder when none is open", async () => {
  const host = fakeHost(async () => RUNNING);
  renderHook(() => useMemory(host, null, true));
  await waitFor(() =>
    expect(host.request).toHaveBeenCalledWith({ type: "memory_status" }),
  );
});

it("reports a failed request, and clears it once one works", async () => {
  let fail = true;
  const host = fakeHost(async () => {
    if (fail) throw new Error("host down");
    return RUNNING;
  });
  const { result, rerender } = renderHook(
    ({ watching }) => useMemory(host, null, watching),
    { initialProps: { watching: true } },
  );
  await waitFor(() => expect(result.current.error).toBe("host down"));
  fail = false;
  rerender({ watching: false });
  rerender({ watching: true });
  await waitFor(() => expect(result.current.error).toBeNull());
  expect(result.current.status).toEqual(RUNNING);
});

it("does nothing without a sidecar", async () => {
  const { result } = renderHook(() => useMemory(null, null, true));
  expect(result.current.status).toBeNull();
  await result.current.changed();
});

it("tells the sidecar about a saved change, even if that fails", async () => {
  const host = fakeHost(async () => {
    throw new Error("host down");
  });
  const { result } = renderHook(() => useMemory(host, null, false));
  await result.current.changed();
  expect(host.request).toHaveBeenCalledWith({ type: "memory_changed" });
});

it("starts another folder unfiltered", async () => {
  const host = fakeHost(async () => RUNNING);
  const { result, rerender } = renderHook(
    ({ folder }) => useMemory(host, folder, true),
    { initialProps: { folder: "/work/a" } },
  );
  act(() => result.current.setKind("bugfix"));
  act(() => result.current.setQuery("timer"));
  expect(result.current).toMatchObject({ kind: "bugfix", query: "timer" });
  rerender({ folder: "/work/b" });
  expect(result.current).toMatchObject({ kind: null, query: "" });
  await waitFor(() =>
    expect(host.request).toHaveBeenLastCalledWith({
      type: "memory_status",
      cwd: "/work/b",
    }),
  );
});

it("asks again for a type at once, and for typed words once typing pauses", async () => {
  vi.useFakeTimers();
  try {
    const host = fakeHost(async () => RUNNING);
    const { result } = renderHook(() => useMemory(host, "/work/app", true));
    await act(() => vi.runAllTimersAsync());
    act(() => result.current.setKind("bugfix"));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(host.request).toHaveBeenLastCalledWith({
      type: "memory_status",
      cwd: "/work/app",
      kind: "bugfix",
    });
    act(() => result.current.setQuery("tim"));
    act(() => result.current.setQuery("timer"));
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(host.request).toHaveBeenCalledTimes(2);
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(host.request).toHaveBeenCalledTimes(3);
    expect(host.request).toHaveBeenLastCalledWith({
      type: "memory_status",
      cwd: "/work/app",
      query: "timer",
      kind: "bugfix",
    });
  } finally {
    vi.useRealTimers();
  }
});
