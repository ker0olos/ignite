import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { describe, expect, it } from "vitest";
import conf from "../../src-tauri/tauri.conf.json";
import {
  NEW_WINDOW_OPTIONS,
  fitToScreenAndShow,
  openNewWindow,
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

  it("starts hidden, because fitToScreenAndShow shows it", () => {
    expect(NEW_WINDOW_OPTIONS.visible).toBe(false);
  });
});
