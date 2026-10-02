import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GitRepoStatus } from "../../shared/git";
import { useGitStatus } from "@/hooks/useGitStatus";
import type { HostClient } from "@/lib/piHost";

const status = (name: string): GitRepoStatus => ({
  repo: `/${name}`,
  name,
  changed: 1,
  unpushed: 0,
});

const hostWith = (request: ReturnType<typeof vi.fn>) =>
  ({ request }) as unknown as HostClient;

afterEach(() => vi.useRealTimers());

describe("useGitStatus", () => {
  it("asks for the conversation's repositories and reads again after 5 seconds", async () => {
    vi.useFakeTimers();
    const request = vi
      .fn()
      .mockResolvedValueOnce([status("a")])
      .mockResolvedValue([status("b")]);
    const host = hostWith(request);
    const { result } = renderHook(() => useGitStatus(host, "s1"));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current).toEqual([status("a")]);
    expect(request).toHaveBeenCalledWith({
      type: "git_status",
      session: "s1",
    });
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(result.current).toEqual([status("b")]);
  });

  it("keeps the last answer when a read fails", async () => {
    vi.useFakeTimers();
    const request = vi
      .fn()
      .mockResolvedValueOnce([status("a")])
      .mockRejectedValue(new Error("gone"));
    const host = hostWith(request);
    const { result } = renderHook(() => useGitStatus(host, "s1"));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current).toEqual([status("a")]);
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(request).toHaveBeenCalledTimes(2);
    expect(result.current).toEqual([status("a")]);
  });

  it("shows nothing of another conversation, and asks nothing without one", async () => {
    const request = vi.fn().mockResolvedValue([status("a")]);
    const host = hostWith(request);
    const { result, rerender } = renderHook(
      ({ session }) => useGitStatus(host, session),
      { initialProps: { session: "s1" as string | null } },
    );
    await waitFor(() => expect(result.current).toHaveLength(1));
    request.mockReturnValue(new Promise(() => {}));
    rerender({ session: "s2" });
    expect(result.current).toEqual([]);
    rerender({ session: null });
    expect(result.current).toEqual([]);
  });
});

it("shows a conversation's last answer again at once when it's shown again", async () => {
  vi.useFakeTimers();
  const request = vi.fn().mockResolvedValue([status("cached")]);
  const host = hostWith(request);
  const { result, rerender } = renderHook(
    ({ session }) => useGitStatus(host, session),
    { initialProps: { session: "remembered" } },
  );
  await act(() => vi.advanceTimersByTimeAsync(0));
  request.mockReturnValue(new Promise(() => {}));
  rerender({ session: "other" });
  rerender({ session: "remembered" });
  expect(result.current).toEqual([status("cached")]);
});
