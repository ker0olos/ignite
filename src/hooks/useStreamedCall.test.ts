import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolCall } from "../../shared/agentTypes";
import { useStreamedCall } from "./useStreamedCall";

const call = (fields: Partial<ToolCall>): ToolCall => ({
  type: "toolCall",
  id: "a",
  name: "show_artifact",
  arguments: {},
  ...fields,
});

describe("useStreamedCall", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("reads a call's arguments as they're written, then takes the finished call at once", () => {
    const { result, rerender } = renderHook(({ c }) => useStreamedCall(c), {
      initialProps: { c: call({ partialJson: '{"title":"Dra' }) },
    });
    expect(result.current.arguments).toEqual({ title: "Dra" });
    rerender({ c: call({ partialJson: '{"title":"Draft"' }) });
    expect(result.current.arguments).toEqual({ title: "Dra" });
    act(() => vi.advanceTimersByTime(300));
    expect(result.current.arguments).toEqual({ title: "Draft" });
    const finished = call({ arguments: { title: "Done" } });
    rerender({ c: finished });
    expect(result.current).toBe(finished);
  });
});
