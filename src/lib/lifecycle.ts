import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask } from "@tauri-apps/plugin-dialog";
import { exit } from "@tauri-apps/plugin-process";
import { APP_TITLE } from "./app";
import { isRemote } from "./remote";

/** Asks before quitting, and quits the whole app only if confirmed. */
export async function confirmQuit() {
  const ok = await ask(`Quit ${APP_TITLE}?`, {
    kind: "warning",
    okLabel: "Quit",
    cancelLabel: "Cancel",
  });
  if (ok) await exit(0);
}

/** Asks before restarting into an update, which ends running agents and commands. */
export const confirmRestart = () =>
  ask(`Restart ${APP_TITLE} to update? Running agents and commands stop.`, {
    kind: "warning",
    okLabel: "Restart",
    cancelLabel: "Cancel",
  });

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

/** Asks before closing a terminal a command still runs in (its command line, when known). */
export function confirmCloseTerminal(command?: string) {
  const message = command
    ? `"${command}" is still running. Stop it and close the terminal?`
    : "Close this terminal? Whatever runs in it stops.";
  // A remote browser has no app dialogs.
  if (isRemote()) return Promise.resolve(window.confirm(message));
  return ask(message, {
    kind: "warning",
    okLabel: "Close",
    cancelLabel: "Cancel",
  });
}
