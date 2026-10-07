import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { afterEach, describe, expect, it, vi } from "vitest";
import conf from "../../src-tauri/tauri.conf.json";
import macConf from "../../src-tauri/tauri.macos.conf.json";
import {
  NEW_WINDOW_OPTIONS,
  fitToScreenAndShow,
  openNewWindow,
  setGlass,
  setGlassTheme,
} from "./window";

type Call = { cmd: string; args: Record<string, unknown> };

/** Fakes the window plugin; `monitor` is what current_monitor returns or throws. */
function fakeWindow(monitor: unknown) {
  const calls: Call[] = [];
  mockWindows("main");
  mockIPC((cmd, args) => {
    calls.push({ cmd, args: args as Record<string, unknown> });
    if (cmd === "plugin:window|current_monitor") {
      if (monitor instanceof Error) throw monitor;
      return monitor;
    }
    return null;
  });
  return calls;
}

// A Retina display (scale 2) whose work area starts below a 33pt menu bar.
const retina = {
  name: "Built-in",
  scaleFactor: 2,
  position: { x: 0, y: 0 },
  size: { width: 2940, height: 1912 },
  workArea: {
    position: { x: 0, y: 66 },
    size: { width: 2940, height: 1846 },
  },
};

const commands = (calls: Call[]) => calls.map((c) => c.cmd);

describe("fitToScreenAndShow", () => {
  it("fills the work area in logical points, leaving the Stage Manager strip", async () => {
    const calls = fakeWindow(retina);
    await fitToScreenAndShow();

    const size = calls.find((c) => c.cmd === "plugin:window|set_size");
    const position = calls.find((c) => c.cmd === "plugin:window|set_position");
    expect(size?.args.value).toMatchObject({
      size: { width: 1470 - 160, height: 923 },
    });
    expect(position?.args.value).toMatchObject({
      position: { x: 160, y: 33 },
    });
  });

  it("shows the window only after sizing it, so it never flashes", async () => {
    const calls = fakeWindow(retina);
    await fitToScreenAndShow();
    expect(commands(calls).slice(-1)).toEqual(["plugin:window|show"]);
    expect(commands(calls).indexOf("plugin:window|set_size")).toBeLessThan(
      commands(calls).indexOf("plugin:window|show"),
    );
  });

  it("maximizes on Windows, where the title and menu bars sit above the content", async () => {
    const ua = vi
      .spyOn(navigator, "userAgent", "get")
      .mockReturnValue("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
    const calls = fakeWindow(retina);
    await fitToScreenAndShow();
    ua.mockRestore();
    expect(commands(calls)).toEqual([
      "plugin:window|maximize",
      "plugin:window|show",
    ]);
  });

  it("still shows the window when there is no monitor", async () => {
    const calls = fakeWindow(null);
    await fitToScreenAndShow();
    expect(commands(calls)).not.toContain("plugin:window|set_size");
    expect(commands(calls)).toContain("plugin:window|show");
  });

  it("still shows the window when the monitor lookup fails", async () => {
    const calls = fakeWindow(new Error("no display"));
    await expect(fitToScreenAndShow()).rejects.toThrow();
    // Windows start hidden, so skipping show() would leave an invisible app.
    expect(commands(calls)).toContain("plugin:window|show");
  });
});

describe("setGlass", () => {
  const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";
  const as = (ua: string) =>
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(ua);
  const glazed = () => document.documentElement.classList.contains("glass");

  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.classList.remove("glass");
  });

  it("glazes the window on macOS, then marks the page", async () => {
    as(mac);
    const calls = fakeWindow(null);
    await setGlass(true);
    expect(commands(calls)).toContain(
      "plugin:liquid-glass|set_liquid_glass_effect",
    );
    expect(glazed()).toBe(true);
  });

  it("leaves the page opaque when the window can't be glazed", async () => {
    as(mac);
    mockWindows("main");
    mockIPC(() => {
      throw new Error("not allowed");
    });
    await expect(setGlass(true)).rejects.toThrow();
    expect(glazed()).toBe(false);
  });

  it("takes the glass away, and the page is opaque even if that fails", async () => {
    as(mac);
    document.documentElement.classList.add("glass");
    const calls = fakeWindow(null);
    await setGlass(false);
    expect(calls[0].args).toMatchObject({ config: { enabled: false } });
    expect(glazed()).toBe(false);
  });

  it("stays opaque when glass is turned off before turning on finished", async () => {
    as(mac);
    fakeWindow(null);
    const on = setGlass(true);
    await setGlass(false);
    await on;
    expect(glazed()).toBe(false);
  });

  it("does nothing on other platforms", async () => {
    as("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
    const calls = fakeWindow(null);
    await setGlass(true);
    expect(calls).toEqual([]);
    expect(glazed()).toBe(false);
  });
});

describe("setGlassTheme", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sets the window's appearance on macOS", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Macintosh");
    const calls = fakeWindow(null);
    await setGlassTheme("dark");
    expect(calls).toMatchObject([
      { cmd: "plugin:window|set_theme", args: { value: "dark" } },
    ]);
  });

  it("leaves other platforms' windows alone", async () => {
    const calls = fakeWindow(null);
    await setGlassTheme("dark");
    expect(calls).toEqual([]);
  });
});

describe("openNewWindow", () => {
  it("creates a window with a new, non-main label and the shared options", async () => {
    const calls = fakeWindow(null);
    openNewWindow();
    await Promise.resolve();
    const create = calls.find(
      (c) => c.cmd === "plugin:webview|create_webview_window",
    );
    const options = create?.args.options as { label: string; title: string };
    expect(options.label).toMatch(/^window-/);
    expect(options.title).toBe(NEW_WINDOW_OPTIONS.title);
  });
});

describe("NEW_WINDOW_OPTIONS", () => {
  const main = conf.app.windows[0];

  it("mirrors the main window in tauri.conf.json", () => {
    expect(NEW_WINDOW_OPTIONS).toMatchObject({
      title: main.title,
      width: main.width,
      height: main.height,
      minWidth: main.minWidth,
      minHeight: main.minHeight,
      visible: main.visible,
      hiddenTitle: main.hiddenTitle,
    });
    expect(NEW_WINDOW_OPTIONS.titleBarStyle).toBe(
      main.titleBarStyle.toLowerCase(),
    );
    expect(NEW_WINDOW_OPTIONS.trafficLightPosition).toMatchObject(
      main.trafficLightPosition,
    );
  });

  it("is transparent only on macOS, where the glass shows through", () => {
    expect(NEW_WINDOW_OPTIONS.transparent).toBe(false);
    expect(macConf.app.windows[0].transparent).toBe(true);
  });

  it("matches the main window in the macOS config but for transparency", () => {
    // Platform configs merge-patch, which replaces the whole windows array.
    expect(macConf.app.windows).toEqual([{ ...main, transparent: true }]);
  });

  it("starts hidden, because fitToScreenAndShow shows it", () => {
    expect(NEW_WINDOW_OPTIONS.visible).toBe(false);
  });
});
