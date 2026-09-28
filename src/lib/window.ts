import {
  currentMonitor,
  getCurrentWindow,
  LogicalPosition,
  LogicalSize,
} from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { APP_TITLE } from "./app";

/** True in the Windows build, where the title and menu bars are native. */
export const isWindows = () => navigator.userAgent.includes("Windows");

// ponytail: 160pt gutter for Stage Manager's strip, macOS exposes no API for its width
const STAGE_MANAGER_STRIP = 160;

/**
 * Windows start hidden; this fills the monitor's work area (leaving room for
 * Stage Manager) and then shows the window. `maximize()` is avoided on macOS
 * because it zooms over the Stage Manager strip; on Windows it's the only way
 * to fit the native title and menu bars above the taskbar.
 */
export async function fitToScreenAndShow() {
  const win = getCurrentWindow();
  try {
    if (isWindows()) return await win.maximize();
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

/** Enters or leaves full screen; the predefined menu item only works on macOS. */
export async function toggleFullscreen() {
  const win = getCurrentWindow();
  await win.setFullscreen(!(await win.isFullscreen()));
}

export function openNewWindow() {
  new WebviewWindow(`window-${Date.now()}`, NEW_WINDOW_OPTIONS);
}
