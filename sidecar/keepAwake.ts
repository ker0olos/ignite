import { spawn, type ChildProcess } from "node:child_process";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse as parseToml } from "smol-toml";
import { APP_NAME } from "../src/lib/app.ts";

/** Whether the app's settings leave keep-awake on (`[power] keep_awake`). */
export async function keepAwakeEnabled(
  settingsFile = join(homedir(), `.${APP_NAME}`, "settings.toml"),
): Promise<boolean> {
  try {
    const settings = parseToml(await readFile(settingsFile, "utf8"));
    const power = settings.power as { keep_awake?: unknown } | undefined;
    return power?.keep_awake !== false;
  } catch {
    return true;
  }
}

/**
 * Keeps macOS from idle-sleeping (`caffeinate -i`) while an agent works and
 * the setting is on; elsewhere does nothing.
 */
export function createKeepAwake(
  enabled = () => keepAwakeEnabled(),
  run = (): ChildProcess =>
    // -w: caffeinate exits with the sidecar, so a crash never leaves the Mac awake.
    spawn("caffeinate", ["-i", "-w", String(process.pid)], { stdio: "ignore" }),
  platform = process.platform,
) {
  let child: ChildProcess | undefined;
  let working = false;
  return async (nowWorking: boolean) => {
    if (platform !== "darwin") return;
    working = nowWorking;
    const on = (await enabled()) && working;
    if (on && !child) {
      child = run();
      child.on("error", () => (child = undefined));
    } else if (!on && child) {
      child.kill();
      child = undefined;
    }
  };
}
