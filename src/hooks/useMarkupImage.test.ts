import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMarkupImage } from "@/hooks/useMarkupImage";

class FakeImage {
  static last: FakeImage;
  onload: (() => void) | null = null;
  src = "";
  naturalWidth = 1800;
  naturalHeight = 600;
  constructor() {
    FakeImage.last = this;
  }
}

const BOX = { width: 900, height: 900 };

describe("useMarkupImage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fits the loaded image to the box, following it as it changes", () => {
    vi.stubGlobal("Image", FakeImage);
    const { result, rerender } = renderHook(
      ({ box }) => useMarkupImage("data:x", false, box),
      { initialProps: { box: BOX } },
    );
    expect(result.current).toEqual({ image: null, scale: 0 });
    act(() => FakeImage.last.onload!());
    expect(result.current.image).toBe(FakeImage.last);
    expect(result.current.scale).toBe(0.5);

    rerender({ box: { width: 4000, height: 4000 } });
    expect(result.current.scale).toBe(1);
    rerender({ box: { width: 0, height: 0 } });
    expect(result.current.scale).toBe(0);
  });

  it("enlarges a vector image to fill the box", () => {
    vi.stubGlobal("Image", FakeImage);
    const { result } = renderHook(() =>
      useMarkupImage("data:x", true, { width: 3600, height: 3600 }),
    );
    act(() => FakeImage.last.onload!());
    expect(result.current.scale).toBe(2);
  });

  it("ignores an image that loads after the editor closed", () => {
    vi.stubGlobal("Image", FakeImage);
    const { result, unmount } = renderHook(() =>
      useMarkupImage("data:x", false, BOX),
    );
    unmount();
    FakeImage.last.onload!();
    expect(result.current.image).toBeNull();
  });
});
