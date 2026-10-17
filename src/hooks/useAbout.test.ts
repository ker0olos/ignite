import { mockIPC } from "@tauri-apps/api/mocks";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { HostClient } from "@/lib/piHost";
import { useAbout } from "./useAbout";

const VERSION = {
  sha: "a1b2c3d4",
  date: "2026-09-28T09:00:00Z",
  subject: "Hi",
};

function fakeHost(answer: (type: string) => Promise<unknown>) {
  return {
    request: vi.fn((r: { type: string }) =>
      answer(r.type),
    ) as unknown as HostClient["request"],
    send: vi.fn(),
    subscribe: () => () => {},
    close: vi.fn(),
  } satisfies HostClient;
}

beforeEach(() => {
  mockIPC(() => null, { shouldMockEvents: true });
});

it("asks for the version at start and again when watching begins", async () => {
  const host = fakeHost(async () => VERSION);
  const { result, rerender } = renderHook(
    ({ watching }) => useAbout(host, watching, vi.fn()),
    { initialProps: { watching: false } },
  );
  await waitFor(() => expect(result.current.version).toEqual(VERSION));
  expect(result.current.error).toBeNull();
  rerender({ watching: true });
  await waitFor(() => expect(host.request).toHaveBeenCalledTimes(2));
});

it("clears a finished check's result when watching begins again", async () => {
  const host = fakeHost(async (type) =>
    type === "app_update" ? { updated: false } : VERSION,
  );
  const { result, rerender } = renderHook(
    ({ watching }) => useAbout(host, watching, vi.fn()),
    { initialProps: { watching: true } },
  );
  await waitFor(() => expect(result.current.version).toEqual(VERSION));
  await act(() => result.current.check());
  expect(result.current.update).toBe("up-to-date");
  rerender({ watching: false });
  rerender({ watching: true });
  await waitFor(() => expect(result.current.update).toBe("idle"));
});

it("reports a version it couldn't read", async () => {
  const host = fakeHost(async () => {
    throw new Error("not a git repository");
  });
  const { result } = renderHook(() => useAbout(host, true, vi.fn()));
  await waitFor(() =>
    expect(result.current.error).toBe("not a git repository"),
  );
});

it("says so when there's nothing new, without reloading", async () => {
  const reload = vi.fn();
  const host = fakeHost(async (type) =>
    type === "app_update" ? { updated: false } : VERSION,
  );
  const { result } = renderHook(() => useAbout(host, false, reload));
  await act(() => result.current.check());
  expect(result.current.update).toBe("up-to-date");
  expect(reload).not.toHaveBeenCalled();
});

it("reloads the windows after an update", async () => {
  const reload = vi.fn();
  const host = fakeHost(async () => ({ updated: true }));
  const { result } = renderHook(() => useAbout(host, false, reload));
  // Let the reload listener register before the update emits.
  await act(() => new Promise((r) => setTimeout(r)));
  await act(() => result.current.check());
  expect(result.current.update).toBe("updated");
  await waitFor(() => expect(reload).toHaveBeenCalled());
});

it("shows git's reason when the update fails", async () => {
  const host = fakeHost(async () => {
    throw new Error("Not possible to fast-forward, aborting.");
  });
  const { result } = renderHook(() => useAbout(host, false, vi.fn()));
  await act(() => result.current.check());
  expect(result.current.update).toEqual({
    error: "Not possible to fast-forward, aborting.",
  });
});

it("does nothing without a host", async () => {
  const { result } = renderHook(() => useAbout(null, true, vi.fn()));
  await act(() => result.current.check());
  expect(result.current.update).toBe("idle");
});

it("readies an update the launcher built, and restarts into it", async () => {
  const quit = vi.fn(async () => {});
  const host = fakeHost(async (type) =>
    type === "app_update" ? { updated: false, ready: true } : VERSION,
  );
  const confirm = vi.fn(async () => true);
  const { result } = renderHook(() =>
    useAbout(host, false, vi.fn(), false, quit, confirm),
  );
  await act(() => result.current.check());
  expect(result.current.update).toBe("ready");
  await act(() => result.current.restart());
  expect(host.request).toHaveBeenCalledWith({ type: "app_restart" });
  expect(quit).toHaveBeenCalledWith(0);
});

it("doesn't restart when the user cancels", async () => {
  const quit = vi.fn(async () => {});
  const host = fakeHost(async () => VERSION);
  const { result } = renderHook(() =>
    useAbout(host, false, vi.fn(), false, quit, async () => false),
  );
  await act(() => result.current.restart());
  expect(host.request).not.toHaveBeenCalledWith({ type: "app_restart" });
  expect(quit).not.toHaveBeenCalled();
});

it("stays ready through a later check that fails", async () => {
  let fail = false;
  const host = fakeHost(async (type) => {
    if (type !== "app_update") return VERSION;
    if (fail) throw new Error("offline");
    return { updated: false, ready: true };
  });
  const { result } = renderHook(() => useAbout(host, false, vi.fn(), false));
  await act(() => result.current.check());
  fail = true;
  await act(() => result.current.check());
  expect(result.current.update).toBe("ready");
});

it("runs one check at a time", async () => {
  let answer: (v: unknown) => void = () => {};
  const host = fakeHost((type) =>
    type === "app_update"
      ? new Promise((r) => (answer = r))
      : Promise.resolve(VERSION),
  );
  const { result } = renderHook(() => useAbout(host, false, vi.fn(), false));
  let first: Promise<void> = Promise.resolve();
  act(() => {
    first = result.current.check();
    void result.current.check();
  });
  await act(async () => {
    answer({ updated: false });
    await first;
  });
  const updates = vi
    .mocked(host.request)
    .mock.calls.filter(([r]) => r.type === "app_update");
  expect(updates).toHaveLength(1);
});

it("checks on its own when started by the launcher", async () => {
  vi.useFakeTimers();
  try {
    const host = fakeHost(async (type) =>
      type === "app_update" ? { updated: false, ready: true } : VERSION,
    );
    const { result } = renderHook(() => useAbout(host, false, vi.fn(), true));
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(result.current.update).toBe("ready");
  } finally {
    vi.useRealTimers();
  }
});
