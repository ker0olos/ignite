import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SessionDetails } from "../../shared/conversations";
import { prefetchDetails, useDetailsCache } from "./useDetailsCache";

const DETAILS: SessionDetails = { recent: [], subtasks: [] };

describe("useDetailsCache", () => {
  it("reads each conversation once per mount, and a new mount starts from what was read", async () => {
    const details = vi.fn(async () => DETAILS);
    const first = renderHook(() => useDetailsCache(details));
    await act(async () => {
      first.result.current.want("/p", "a");
      first.result.current.want("/p", "a");
    });
    expect(details).toHaveBeenCalledTimes(1);
    expect(first.result.current.known.a).toEqual(DETAILS);
    first.unmount();

    const again = renderHook(() => useDetailsCache(details));
    expect(again.result.current.known.a).toEqual(DETAILS);
    await act(async () => again.result.current.want("/p", "a"));
    expect(details).toHaveBeenCalledTimes(2);
  });

  it("doesn't keep a read that failed, so a new mount shows it loading", async () => {
    const failed = vi.fn(async () => null);
    const { result, unmount } = renderHook(() => useDetailsCache(failed));
    await act(async () => result.current.want("/p", "b"));
    expect(result.current.known.b).toBeNull();
    unmount();
    expect(
      renderHook(() => useDetailsCache(failed)).result.current.known.b,
    ).toBeUndefined();
  });

  it("prefetches one for the next mount", async () => {
    await act(async () => prefetchDetails(async () => DETAILS, "/p", "c"));
    const read = vi.fn(async () => DETAILS);
    expect(
      renderHook(() => useDetailsCache(read)).result.current.known.c,
    ).toEqual(DETAILS);
  });
});
