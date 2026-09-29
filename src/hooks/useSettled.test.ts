import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CommandPick } from "@/lib/commandQuery";
import { usePreviewPick } from "./useSettled";

const file = (path: string): CommandPick => ({
  kind: "file",
  folder: "/f",
  path,
});
const chat: CommandPick = { kind: "conversation", folder: "/f", id: "c1" };

describe("usePreviewPick", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("previews the first file at once, a later one once it stays picked, anything else at once", () => {
    const { result, rerender } = renderHook(
      ({ pick }) => usePreviewPick(pick),
      { initialProps: { pick: file("a.ts") } },
    );
    expect(result.current).toEqual(file("a.ts"));

    rerender({ pick: file("b.ts") });
    act(() => vi.advanceTimersByTime(100));
    rerender({ pick: file("c.ts") });
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toEqual(file("a.ts"));
    act(() => vi.advanceTimersByTime(50));
    expect(result.current).toEqual(file("c.ts"));

    rerender({ pick: chat });
    expect(result.current).toBe(chat);
  });
});
