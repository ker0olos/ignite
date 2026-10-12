import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useFrameEscape } from "./useFrameEscape";
import { ESCAPE_MESSAGE } from "@/lib/artifact";

const post = (type: string) =>
  window.dispatchEvent(new MessageEvent("message", { data: { type } }));

describe("useFrameEscape", () => {
  it("runs on a frame's Esc while active", () => {
    const onEscape = vi.fn();
    renderHook(() => useFrameEscape(true, onEscape));
    post("other");
    expect(onEscape).not.toHaveBeenCalled();
    post(ESCAPE_MESSAGE);
    expect(onEscape).toHaveBeenCalledOnce();
  });

  it("ignores it while inactive", () => {
    const onEscape = vi.fn();
    renderHook(() => useFrameEscape(false, onEscape));
    post(ESCAPE_MESSAGE);
    expect(onEscape).not.toHaveBeenCalled();
  });
});
