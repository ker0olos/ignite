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
      [SETTINGS_FILE]: 'theme = "nord"\n[files]\nhide_gitignored = false\n',
    });
    fakeSystemAppearance(false);
    const { result } = renderHook(() => useSettings());
    await waitFor(() =>
      expect(result.current[0]).toEqual({
        theme: "nord",
        files: { hide_gitignored: false },
      }),
    );
  });

  describe("light or dark mode follows the theme", () => {
    it("a dark theme turns on dark mode even on a light system", async () => {
      fakeFs(toml("github-dark"));
      fakeSystemAppearance(false);
      renderHook(() => useSettings());
      await waitFor(() => expect(isDark()).toBe(true));
    });

    it("a light theme turns off dark mode even on a dark system", async () => {
      fakeFs(toml("github-light"));
      fakeSystemAppearance(true);
      const { result } = renderHook(() => useSettings());
      await waitFor(() => expect(result.current[0].theme).toBe("github-light"));
      await waitFor(() => expect(isDark()).toBe(false));
    });

    it("a VS Code theme uses the kind its extension declares", async () => {
      const ext = "/me/.vscode/extensions/me.light-1.0.0";
      fakeFs(
        {
          ...toml("vscode:me.light/Paper"),
          [`${ext}/package.json`]: JSON.stringify({
            name: "light",
            publisher: "me",
            contributes: {
              themes: [{ label: "Paper", uiTheme: "vs", path: "./t.json" }],
            },
          }),
        },
        (cmd) => (cmd === "plugin:path|resolve_directory" ? "/me" : null),
      );
      fakeSystemAppearance(true);
      // codeThemes caches discovered themes per module; start fresh.
      vi.resetModules();
      const { useSettings } = await import("./useSettings");
      renderHook(() => useSettings());
      await waitFor(() => expect(isDark()).toBe(false));
    });

    it("an unknown theme follows the system", async () => {
      fakeFs(toml("vscode:gone.theme/Missing"), (cmd) =>
        cmd === "plugin:path|resolve_directory" ? "/me" : null,
      );
      fakeSystemAppearance(true);
      vi.resetModules();
      const { useSettings } = await import("./useSettings");
      renderHook(() => useSettings());
      await waitFor(() => expect(isDark()).toBe(true));
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
    const next: Settings = {
      theme: "github-dark",
      files: { hide_gitignored: true },
    };
    act(() => result.current[1](next));
    expect(result.current[0]).toEqual(next);
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(parse(writes[0])).toEqual(next);
  });

  it("picks up changes saved by another window", async () => {
    fakeFs({});
    fakeSystemAppearance(false);
    const { result } = renderHook(() => useSettings());
    const next: Settings = {
      theme: "dracula",
      files: { hide_gitignored: false },
    };
    await act(() => saveSettings(next));
    expect(result.current[0]).toEqual(next);
  });
});
