import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FallbackKeyInfo } from "../../shared/fallbackKeys";
import type { HostClient } from "@/lib/piHost";
import { useFallbackKeys } from "./useFallbackKeys";

const a: FallbackKeyInfo = { id: "a", hint: "abcd" };
const b: FallbackKeyInfo = { id: "b", hint: "wxyz" };

const fakeHost = (answer: (req: { type: string }) => Promise<unknown>) =>
  ({ request: vi.fn(answer) }) as unknown as HostClient & {
    request: ReturnType<typeof vi.fn>;
  };

describe("useFallbackKeys", () => {
  it("fetches while open, not before", async () => {
    const host = fakeHost(async () => [a]);
    const { result, rerender } = renderHook(
      ({ open }) => useFallbackKeys(host, open),
      { initialProps: { open: false } },
    );
    expect(host.request).not.toHaveBeenCalled();
    rerender({ open: true });
    await waitFor(() => expect(result.current.keys).toEqual([a]));
    expect(host.request).toHaveBeenCalledWith({ type: "fallback_keys" });
  });

  it("takes the new list after add, move and remove", async () => {
    const host = fakeHost(async (req) =>
      req.type === "fallback_key_move" ? [b, a] : [a, b],
    );
    const { result } = renderHook(() => useFallbackKeys(host, true));
    await waitFor(() => expect(result.current.keys).toEqual([a, b]));
    await act(() => result.current.move("b", -1));
    expect(result.current.keys).toEqual([b, a]);
    expect(host.request).toHaveBeenLastCalledWith({
      type: "fallback_key_move",
      key: "b",
      by: -1,
    });
    await act(() => result.current.add("sk-1"));
    expect(host.request).toHaveBeenLastCalledWith({
      type: "fallback_key_add",
      apiKey: "sk-1",
    });
    await act(() => result.current.remove("a"));
    expect(host.request).toHaveBeenLastCalledWith({
      type: "fallback_key_remove",
      key: "a",
    });
  });

  it("keeps an error from loading, moving or removing, and throws add's", async () => {
    const host = fakeHost(async (req) => {
      if (req.type === "fallback_keys") return [a];
      throw new Error("nope");
    });
    const { result } = renderHook(() => useFallbackKeys(host, true));
    await waitFor(() => expect(result.current.keys).toEqual([a]));
    await act(() => result.current.move("a", 1));
    expect(result.current.error).toBe("nope");
    await act(() => result.current.remove("a"));
    expect(result.current.error).toBe("nope");
    await expect(result.current.add("k")).rejects.toThrow("nope");

    const failing = fakeHost(() => Promise.reject(new Error("down")));
    const { result: r2 } = renderHook(() => useFallbackKeys(failing, true));
    await waitFor(() => expect(r2.current.error).toBe("down"));
  });

  it("does nothing without a host", async () => {
    const { result } = renderHook(() => useFallbackKeys(null, true));
    await act(() => result.current.remove("a"));
    await act(() => result.current.move("a", 1));
    await expect(result.current.add("k")).rejects.toThrow();
    expect(result.current.keys).toBeNull();
  });
});
