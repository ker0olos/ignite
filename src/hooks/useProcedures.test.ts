import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Procedure } from "../../shared/procedures";
import type { HostClient } from "@/lib/piHost";
import { useProcedures } from "./useProcedures";

const proc = (id: number): Procedure => ({
  id,
  title: `Fix ${id}`,
  steps: ["one"],
  folder: "/f",
  at: 0,
});

const fakeHost = (answer: (req: { type: string }) => Promise<unknown>) =>
  ({ request: vi.fn(answer) }) as unknown as HostClient;

describe("useProcedures", () => {
  it("fetches only while open, then removes", async () => {
    const host = fakeHost(async (r) =>
      r.type === "procedures_list" ? [proc(1), proc(2)] : [proc(2)],
    );
    const { result, rerender } = renderHook(
      ({ open }) => useProcedures(host, open),
      { initialProps: { open: false } },
    );
    expect(host.request).not.toHaveBeenCalled();
    rerender({ open: true });
    await waitFor(() => expect(result.current.procedures).toHaveLength(2));
    await act(() => result.current.remove(1));
    expect(result.current.procedures).toEqual([proc(2)]);
    expect(result.current.error).toBeNull();
  });

  it("reports a failed read or remove", async () => {
    const host = fakeHost(async () => {
      throw new Error("unreadable");
    });
    const { result } = renderHook(() => useProcedures(host, true));
    await waitFor(() => expect(result.current.error).toBe("unreadable"));
    await act(() => result.current.remove(1));
    expect(result.current.error).toBe("unreadable");
  });

  it("does nothing without a host", async () => {
    const { result } = renderHook(() => useProcedures(null, true));
    await act(() => result.current.remove(1));
    expect(result.current.procedures).toBeNull();
  });
});
