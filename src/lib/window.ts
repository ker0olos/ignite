import {
  currentMonitor,
  getCurrentWindow,
  LogicalPosition,
  LogicalSize,
} from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { APP_TITLE } from "./app";

// ponytail: 160pt gutter for Stage Manager's strip, macOS exposes no API for its width
const STAGE_MANAGER_STRIP = 160;

/**
 * Windows start hidden; this fills the monitor's work area (leaving room for
 * Stage Manager) and then shows the window. `maximize()` is avoided because it
 * zooms over the Stage Manager strip.
 */
export async function fitToScreenAndShow() {
  const win = getCurrentWindow();
  try {
    const monitor = await currentMonitor();
    if (!monitor) return;
    const { x, y } = monitor.workArea.position.toLogical(monitor.scaleFactor);
    const { width, height } = monitor.workArea.size.toLogical(
      monitor.scaleFactor,
    );
    await win.setSize(new LogicalSize(width - STAGE_MANAGER_STRIP, height));
    await win.setPosition(new LogicalPosition(x + STAGE_MANAGER_STRIP, y));
  } finally {
    await win.show();
  }
}

/**
 * Options for extra windows. Must mirror the "main" window in tauri.conf.json;
 * window.test.ts fails if they drift apart.
 */
export const NEW_WINDOW_OPTIONS = {
  title: APP_TITLE,
  width: 900,
  height: 600,
  minWidth: 720,
  minHeight: 480,
  visible: false,
  titleBarStyle: "overlay",
  hiddenTitle: true,
  trafficLightPosition: new LogicalPosition(20, 28),
} as const;

export function openNewWindow() {
  new WebviewWindow(`window-${Date.now()}`, NEW_WINDOW_OPTIONS);
}
