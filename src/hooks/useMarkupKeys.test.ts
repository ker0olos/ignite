import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMarkupKeys } from "@/hooks/useMarkupKeys";

const press = (
  key: string,
  init: KeyboardEventInit = {},
  on: EventTarget = window,
) => {
  const e = new KeyboardEvent("keydown", {
    key,
    cancelable: true,
    bubbles: true,
    ...init,
  });
  on.dispatchEvent(e);
  return e;
};

describe("useMarkupKeys", () => {
  it("runs shortcuts first and keeps handled ones from the rest of the app", () => {
    const act = vi.fn(() => true);
    const later = vi.fn();
    window.addEventListener("keydown", later);
    renderHook(() => useMarkupKeys(act));

    const z = press("z", { metaKey: true });
    expect(act).toHaveBeenCalledWith("undo");
    expect(z.defaultPrevented).toBe(true);
    expect(later).not.toHaveBeenCalled();
    window.removeEventListener("keydown", later);
  });

  it("lets keys it doesn't handle through", () => {
    const act = vi.fn(() => false);
    const later = vi.fn();
    window.addEventListener("keydown", later);
    renderHook(() => useMarkupKeys(act));

    const zoom = press("=", { metaKey: true });
    expect(act).toHaveBeenCalledWith("zoomIn");
    expect(zoom.defaultPrevented).toBe(false);
    press("Escape");
    expect(later).toHaveBeenCalledTimes(2);
    window.removeEventListener("keydown", later);
  });

  it("ignores typing in a field, and stops after unmount", () => {
    const act = vi.fn(() => true);
    const { unmount } = renderHook(() => useMarkupKeys(act));
    const field = document.createElement("textarea");
    document.body.append(field);
    press("p", {}, field);
    field.remove();
    expect(act).not.toHaveBeenCalled();

    unmount();
    press("p");
    expect(act).not.toHaveBeenCalled();
  });
});
