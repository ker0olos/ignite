import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HostClient } from "@/lib/piHost";
import { useCommandSearch } from "./useCommandSearch";

const FOLDERS = ["/p/motr", "/p/ignition"];

function setup(answer: () => Promise<{ conversations: []; files: [] }>) {
  const request = vi.fn(answer);
  const host = { request } as unknown as HostClient;
  return { request, host };
}

describe("useCommandSearch", () => {
  it("searches both kinds across every folder with a limit of 6 by default", async () => {
    vi.useFakeTimers();
    const { request, host } = setup(async () => ({
      conversations: [],
      files: [],
    }));
    const { result } = renderHook(() =>
      useCommandSearch(host, "sentry", FOLDERS),
    );
    expect(result.current.loading).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(request).toHaveBeenCalledWith({
      type: "command_search",
      text: "sentry",
      folders: FOLDERS,
      kinds: ["conversation", "file"],
      limit: 6,
    });
    expect(result.current.loading).toBe(false);
    vi.useRealTimers();
  });

  it("raises the limit to 50 once a #kind filter narrows the results", async () => {
    vi.useFakeTimers();
    const { request, host } = setup(async () => ({
      conversations: [],
      files: [],
    }));
    renderHook(() => useCommandSearch(host, "#files sentry", FOLDERS));
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(request).toHaveBeenCalledWith({
      type: "command_search",
      text: "sentry",
      folders: FOLDERS,
      kinds: ["file"],
      limit: 50,
    });
    vi.useRealTimers();
  });

  it("narrows the search to one folder with @name", async () => {
    vi.useFakeTimers();
    const { request, host } = setup(async () => ({
      conversations: [],
      files: [],
    }));
    renderHook(() => useCommandSearch(host, "@ignition x", FOLDERS));
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ folders: ["/p/ignition"], limit: 6 }),
    );
    vi.useRealTimers();
  });

  it("computes folder hits locally, without asking the sidecar", () => {
    const { host } = setup(async () => ({ conversations: [], files: [] }));
    const { result } = renderHook(() =>
      useCommandSearch(host, "ignit", FOLDERS),
    );
    expect(result.current.folders).toEqual(["/p/ignition"]);
  });

  it("drops folder hits when a #kind filter excludes folders", () => {
    const { host } = setup(async () => ({ conversations: [], files: [] }));
    const { result } = renderHook(() =>
      useCommandSearch(host, "#files ignit", FOLDERS),
    );
    expect(result.current.folders).toEqual([]);
  });

  it("suggests folder names for @ and kind filters for #", () => {
    const { host } = setup(async () => ({ conversations: [], files: [] }));
    const at = renderHook(() => useCommandSearch(host, "@ign", FOLDERS));
    expect(at.result.current.suggestions).toEqual([
      { token: "@ignition", label: "/p/ignition" },
    ]);
    const hash = renderHook(() => useCommandSearch(host, "#fi", FOLDERS));
    expect(hash.result.current.suggestions.map((s) => s.token)).toEqual([
      "#files",
    ]);
  });

  it("goes back to loading, then settles, when the query changes", async () => {
    vi.useFakeTimers();
    const { host } = setup(async () => ({ conversations: [], files: [] }));
    const { result, rerender } = renderHook(
      ({ q }) => useCommandSearch(host, q, FOLDERS),
      { initialProps: { q: "a" } },
    );
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(result.current.loading).toBe(false);
    rerender({ q: "b" });
    expect(result.current.loading).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(result.current.loading).toBe(false);
    vi.useRealTimers();
  });

  it("clears results instead of throwing when the request fails", async () => {
    vi.useFakeTimers();
    const { host } = setup(async () => {
      throw new Error("gone");
    });
    const { result } = renderHook(() =>
      useCommandSearch(host, "sentry", FOLDERS),
    );
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(result.current.conversations).toEqual([]);
    expect(result.current.files).toEqual([]);
    expect(result.current.loading).toBe(false);
    vi.useRealTimers();
  });
});
