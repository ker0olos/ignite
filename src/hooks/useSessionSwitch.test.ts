import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HostClient } from "@/lib/piHost";
import { useSessionSwitch } from "./useSessionSwitch";

describe("close", () => {
  it("shows the neighbour before the sidecar finishes ending the conversation", async () => {
    const asked: string[] = [];
    const host = {
      // Ending one saves its worktree; it hasn't answered yet.
      request: vi.fn((r: { type: string }) => {
        asked.push(r.type);
        return new Promise(() => {});
      }),
    } as unknown as HostClient;
    const reshow = vi.fn(() => true);
    const drop = vi.fn();
    const { result } = renderHook(() =>
      useSessionSwitch({
        host,
        folder: "/f",
        put: vi.fn(() => true),
        preview: vi.fn(),
        reshow,
        drop,
        setError: vi.fn(),
      }),
    );
    void result.current.close("b", "b", ["a", "b", "c"]);
    expect(reshow).toHaveBeenCalledWith("/f", "c");
    expect(asked).toContain("close_session");
    expect(drop).not.toHaveBeenCalled();
  });

  it("says whether the sidecar ended it", async () => {
    const setError = vi.fn();
    const switchWith = (request: () => Promise<unknown>) =>
      renderHook(() =>
        useSessionSwitch({
          host: { request } as unknown as HostClient,
          folder: "/f",
          put: vi.fn(() => true),
          preview: vi.fn(),
          reshow: vi.fn(() => true),
          drop: vi.fn(),
          setError,
        }),
      ).result.current;
    const ok = switchWith(() => Promise.resolve());
    expect(await ok.close("a", "b", ["a", "b"])).toBe(true);
    const failing = switchWith(() => Promise.reject(new Error("busy")));
    expect(await failing.close("a", "b", ["a", "b"])).toBe(false);
    expect(setError).toHaveBeenCalledWith("busy");
  });
});
