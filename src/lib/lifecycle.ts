import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask } from "@tauri-apps/plugin-dialog";
import { exit } from "@tauri-apps/plugin-process";
import { APP_TITLE } from "./app";

/** Asks before quitting, and quits the whole app only if confirmed. */
export async function confirmQuit() {
  const ok = await ask(`Quit ${APP_TITLE}?`, {
    kind: "warning",
    okLabel: "Quit",
    cancelLabel: "Cancel",
  });
  if (ok) await exit(0);
}

/**
 * Makes every way of closing this window (menu, shortcut, red traffic light)
 * ask first. Returns a promise of the unlisten function.
 */
export function confirmBeforeClose() {
  return getCurrentWindow().onCloseRequested(async (event) => {
    const ok = await ask("Close this window?", {
      kind: "warning",
      okLabel: "Close",
      cancelLabel: "Cancel",
    });
    if (!ok) event.preventDefault();
  });
}
