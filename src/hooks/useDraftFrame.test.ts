import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDraftFrame } from "./useDraftFrame";

describe("useDraftFrame", () => {
  it("posts each draft once the frame's shell has loaded", () => {
    const postMessage = vi.fn();
    const frame = {
      contentWindow: { postMessage },
    } as unknown as HTMLIFrameElement;
    const { result, rerender } = renderHook(({ page }) => useDraftFrame(page), {
      initialProps: { page: "<p>a</p>" as string | undefined },
    });
    act(() => result.current[0](frame));
    expect(postMessage).not.toHaveBeenCalled();
    act(() => result.current[1]());
    expect(postMessage).toHaveBeenLastCalledWith(
      { type: "ignite-draft", html: "<p>a</p>" },
      "*",
    );
    rerender({ page: undefined });
    expect(postMessage).toHaveBeenCalledTimes(1);
  });
});
