import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HostClient } from "@/lib/piHost";
import { useFileSearch } from "./useFileSearch";

function setup(answer: () => Promise<{ conversations: []; files: [] }>) {
  const request = vi.fn(answer);
  const host = { request } as unknown as HostClient;
  return { request, host };
}

describe("useFileSearch", () => {
  it("searches files in the current folder", async () => {
    vi.useFakeTimers();
    const { request, host } = setup(async () => ({
      conversations: [],
      files: [],
    }));
    const { result } = renderHook(() => useFileSearch(host, "/repo", "app"));
    expect(result.current.loading).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(request).toHaveBeenCalledWith({
      type: "command_search",
      text: "app",
      folders: ["/repo"],
      kinds: ["file"],
      limit: 50,
    });
    expect(result.current.loading).toBe(false);
    vi.useRealTimers();
  });

  it("does not search without a host or folder", () => {
    const { request, host } = setup(async () => ({
      conversations: [],
      files: [],
    }));
    const missingHost = renderHook(() => useFileSearch(null, "/repo", "app"));
    const missingFolder = renderHook(() => useFileSearch(host, null, "app"));
    expect(missingHost.result.current.loading).toBe(false);
    expect(missingFolder.result.current.loading).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });

  it("clears files when the request fails", async () => {
    vi.useFakeTimers();
    const request = vi.fn(async () => {
      throw new Error("gone");
    });
    const host = { request } as unknown as HostClient;
    const { result } = renderHook(() => useFileSearch(host, "/repo", "app"));
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(result.current.files).toEqual([]);
    expect(result.current.loading).toBe(false);
    vi.useRealTimers();
  });
});
