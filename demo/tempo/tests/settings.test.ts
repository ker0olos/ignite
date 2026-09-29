import { beforeEach, describe, expect, it, vi } from "vitest";
import { applySettings, loadSettings } from "../src/settings";
import { applyTheme } from "../src/theme";
import { setDurations } from "../src/timer";

vi.mock("../src/theme", () => ({ applyTheme: vi.fn() }));
vi.mock("../src/timer", () => ({ setDurations: vi.fn() }));

const saved = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => saved.get(key) ?? null,
  setItem: (key: string, value: string) => saved.set(key, value),
});

beforeEach(() => saved.clear());

describe("loadSettings", () => {
  it("starts from the defaults", () => {
    expect(loadSettings()).toEqual({
      focusMinutes: 25,
      breakMinutes: 5,
      sound: true,
      theme: "system",
    });
  });

  it("keeps what was saved over the defaults", () => {
    saved.set("tempo.settings", JSON.stringify({ focusMinutes: 50 }));
    expect(loadSettings()).toMatchObject({ focusMinutes: 50, breakMinutes: 5 });
  });
});

describe("applySettings", () => {
  it("saves the settings, so the next visit loads them", () => {
    const settings = { ...loadSettings(), sound: false };
    applySettings(settings);
    expect(loadSettings()).toEqual(settings);
  });

  it("puts the durations and theme into effect", () => {
    applySettings({
      focusMinutes: 45,
      breakMinutes: 15,
      sound: true,
      theme: "dark",
    });
    expect(setDurations).toHaveBeenCalledWith(45, 15);
    expect(applyTheme).toHaveBeenCalledWith("dark");
  });
});
