import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ImageContent } from "../../shared/agentTypes";
import { useImageTarget, useProvideImageTarget } from "@/hooks/useImageTarget";

const image: ImageContent = {
  type: "image",
  data: "QQ==",
  mimeType: "image/png",
};

describe("useImageTarget", () => {
  it("sees the mounted input's target, calling its latest add, until it unmounts", () => {
    const shown = renderHook(() => useImageTarget());
    expect(shown.result.current).toBeNull();

    const first = vi.fn();
    const second = vi.fn();
    const input = renderHook(
      ({ add }) => useProvideImageTarget("Add to chat", add),
      { initialProps: { add: first } },
    );
    expect(shown.result.current?.label).toBe("Add to chat");

    input.rerender({ add: second });
    act(() => shown.result.current!.add(image, "Shot"));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(image, "Shot");

    input.unmount();
    expect(shown.result.current).toBeNull();
  });
});
