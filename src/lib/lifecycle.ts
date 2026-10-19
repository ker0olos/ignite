import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask } from "@tauri-apps/plugin-dialog";
import { exit } from "@tauri-apps/plugin-process";
import { APP_TITLE } from "./app";
import { isRemote } from "./remote";

/** Asks in the system's dialog, as every confirmation in the app does; a remote browser has none, so it uses its own. */
export function confirmNative(
  message: string,
  okLabel: string,
  cancelLabel = "Cancel",
) {
  if (isRemote()) return Promise.resolve(window.confirm(message));
  return ask(message, { kind: "warning", okLabel, cancelLabel });
}

/** Asks before quitting, and quits the whole app only if confirmed. */
export async function confirmQuit() {
  if (await confirmNative(`Quit ${APP_TITLE}?`, "Quit")) await exit(0);
}

/** Asks before restarting into an update, which ends running agents and commands. */
export const confirmRestart = () =>
  confirmNative(
    `Restart ${APP_TITLE} to update? Running agents and commands stop.`,
    "Restart",
  );

/**
 * Makes every way of closing this window (menu, shortcut, red traffic light)
 * ask first. Returns a promise of the unlisten function.
 */
export function confirmBeforeClose() {
  return getCurrentWindow().onCloseRequested(async (event) => {
    if (!(await confirmNative("Close this window?", "Close"))) {
      event.preventDefault();
    }
  });
}

/** Asks before closing a terminal a command still runs in (its command line, when known). */
export function confirmCloseTerminal(command?: string) {
  return confirmNative(
    command
      ? `"${command}" is still running. Stop it and close the terminal?`
      : "Close this terminal? Whatever runs in it stops.",
    "Close",
  );
}

/** Asks before closing a conversation from the sidebar (easy to hit by mistake); it stays saved. */
export const confirmCloseConversation = (title: string) =>
  confirmNative(
    `Close "${title}"? It stays saved, and History opens it again.`,
    "Close",
  );
