import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/settings";
import { useTextSize } from "./useTextSize";

const withSize = (text_size: number): Settings => ({
  ...DEFAULT_SETTINGS,
  conversation: { ...DEFAULT_SETTINGS.conversation, text_size },
});

const press = (init: KeyboardEventInit) => {
  const event = new KeyboardEvent("keydown", { cancelable: true, ...init });
  window.dispatchEvent(event);
  return event;
};

describe("useTextSize", () => {
  it("applies the size as a CSS variable", () => {
    renderHook(() => useTextSize(withSize(15), vi.fn()));
    expect(
      document.documentElement.style.getPropertyValue("--message-text"),
    ).toBe("15px");
  });

  it.each([{ metaKey: true }, { ctrlKey: true }])(
    "saves a bigger size on %o with =",
    (mods) => {
      const save = vi.fn().mockResolvedValue(undefined);
      renderHook(() => useTextSize(withSize(13), save));
      expect(press({ key: "=", ...mods }).defaultPrevented).toBe(true);
      expect(save).toHaveBeenCalledWith(withSize(14));
    },
  );

  it("ignores the key without ⌘/Ctrl, or with Option", () => {
    const save = vi.fn();
    renderHook(() => useTextSize(withSize(13), save));
    press({ key: "=" });
    press({ key: "=", metaKey: true, altKey: true });
    press({ key: "k", metaKey: true });
    expect(save).not.toHaveBeenCalled();
  });

  it("doesn't save when already at the limit", () => {
    const save = vi.fn();
    renderHook(() => useTextSize(withSize(24), save));
    expect(press({ key: "=", metaKey: true }).defaultPrevented).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });
});
