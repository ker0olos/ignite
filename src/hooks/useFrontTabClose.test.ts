import { renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { closeFrontTab, useFrontTabClose } from "./useFrontTabClose";

it("closes the strip's front tab, and tells Close Tab it did", () => {
  const close = vi.fn();
  const { unmount } = renderHook(() => useFrontTabClose(close));
  expect(closeFrontTab()).toBe(false);
  expect(close).toHaveBeenCalledOnce();
  unmount();
  expect(closeFrontTab()).toBe(true);
});

it("leaves ⌘W to Close Tab when the strip has nothing to close", () => {
  renderHook(() => useFrontTabClose(null));
  expect(closeFrontTab()).toBe(true);
});
