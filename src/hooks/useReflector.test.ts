import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Reflection } from "../../shared/reflector";
import type { HostClient } from "@/lib/piHost";
import { useReflector } from "./useReflector";

const point = (id: string, text: string): Reflection => ({
  id,
  text,
  entry: "always",
  taught: "reply",
  at: 0,
});

const fakeHost = (
  answer: (req: { type: string; text?: string }) => Promise<unknown>,
) => ({ request: vi.fn(answer) }) as unknown as HostClient;

describe("useReflector", () => {
  it("fetches only while open, then removes and edits", async () => {
    const host = fakeHost(async (r) =>
      r.type === "reflections_list"
        ? [point("a", "Be brief"), point("b", "Test first")]
        : r.type === "reflections_remove"
          ? [point("b", "Test first")]
          : [point("b", r.text ?? "")],
    );
    const { result, rerender } = renderHook(
      ({ open }) => useReflector(host, open),
      { initialProps: { open: false } },
    );
    expect(host.request).not.toHaveBeenCalled();
    rerender({ open: true });
    await waitFor(() => expect(result.current.reflections).toHaveLength(2));
    await act(() => result.current.remove("a"));
    expect(result.current.reflections).toEqual([point("b", "Test first")]);
    await act(() => result.current.edit("b", "Test twice"));
    expect(result.current.reflections?.[0].text).toBe("Test twice");
    expect(result.current.error).toBeNull();
  });

  it("reports a failed read, remove or edit", async () => {
    const host = fakeHost(async () => {
      throw new Error("unreadable");
    });
    const { result } = renderHook(() => useReflector(host, true));
    await waitFor(() => expect(result.current.error).toBe("unreadable"));
    await act(() => result.current.remove("a"));
    expect(result.current.error).toBe("unreadable");
    await act(() => result.current.edit("a", "x"));
    expect(result.current.error).toBe("unreadable");
  });

  it("does nothing without a host", async () => {
    const { result } = renderHook(() => useReflector(null, true));
    await act(() => result.current.remove("a"));
    expect(result.current.reflections).toBeNull();
  });
});
