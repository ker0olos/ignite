import { act, renderHook, waitFor } from "@testing-library/react";
import { parse } from "smol-toml";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SETTINGS_FILE, saveSettings, type Settings } from "@/lib/settings";
import { fakeFs } from "@/test/fakeFs";
import { useSettings } from "./useSettings";

/** jsdom has no matchMedia; this fake lets tests flip the system appearance. */
function fakeSystemAppearance(dark: boolean) {
  const listeners = new Set<() => void>();
  const media = {
    matches: dark,
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
  };
  vi.stubGlobal("matchMedia", () => media);
  return {
    set(next: boolean) {
      media.matches = next;
      listeners.forEach((cb) => cb());
    },
  };
}

const isDark = () => document.documentElement.classList.contains("dark");
const toml = (theme: string) => ({ [SETTINGS_FILE]: `theme = "${theme}"\n` });

beforeEach(() => document.documentElement.classList.remove("dark"));

describe("useSettings", () => {
  it("loads settings from settings.toml", async () => {
    fakeFs({
      [SETTINGS_FILE]: 'theme = "light"\n[files]\nhide_gitignored = false\n',
    });
    fakeSystemAppearance(false);
    const { result } = renderHook(() => useSettings());
    await waitFor(() =>
      expect(result.current[0]).toEqual({
        theme: "light",
        files: { hide_gitignored: false },
      }),
    );
  });

  describe("theme", () => {
    it("dark forces dark mode even on a light system", async () => {
      fakeFs(toml("dark"));
      fakeSystemAppearance(false);
      renderHook(() => useSettings());
      await waitFor(() => expect(isDark()).toBe(true));
    });

    it("light forces light mode even on a dark system", async () => {
      fakeFs(toml("light"));
      fakeSystemAppearance(true);
      const { result } = renderHook(() => useSettings());
      await waitFor(() => expect(result.current[0].theme).toBe("light"));
      expect(isDark()).toBe(false);
    });

    it("system follows the OS appearance, including live changes", async () => {
      fakeFs(toml("system"));
      const system = fakeSystemAppearance(false);
      renderHook(() => useSettings());
      await waitFor(() => expect(isDark()).toBe(false));
      act(() => system.set(true));
      expect(isDark()).toBe(true);
    });
  });

  it("saves changes to settings.toml", async () => {
    const { writes } = fakeFs({});
    fakeSystemAppearance(false);
    const { result } = renderHook(() => useSettings());
    const next: Settings = { theme: "dark", files: { hide_gitignored: true } };
    act(() => result.current[1](next));
    expect(result.current[0]).toEqual(next);
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(parse(writes[0])).toEqual(next);
  });

  it("picks up changes saved by another window", async () => {
    fakeFs({});
    fakeSystemAppearance(false);
    const { result } = renderHook(() => useSettings());
    const next: Settings = { theme: "dark", files: { hide_gitignored: false } };
    await act(() => saveSettings(next));
    expect(result.current[0]).toEqual(next);
  });
});
