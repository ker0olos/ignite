import { spawn, type ChildProcess } from "node:child_process";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse as parseToml } from "smol-toml";
import { APP_NAME } from "../src/lib/app.ts";

/**
 * caffeinate's flags for the app's `[power]` settings: `-i` for keep_awake,
 * `-di` when keep_screen_awake too, null when keep-awake is off.
 */
export async function keepAwakeFlags(
  settingsFile = join(homedir(), `.${APP_NAME}`, "settings.toml"),
): Promise<string | null> {
  let power: { keep_awake?: unknown; keep_screen_awake?: unknown } | undefined;
  try {
    power = parseToml(await readFile(settingsFile, "utf8"))
      .power as typeof power;
  } catch {
    return "-i";
  }
  if (power?.keep_awake === false) return null;
  return power?.keep_screen_awake === true ? "-di" : "-i";
}

/**
 * Keeps macOS from idle-sleeping (`caffeinate`) while an agent works and
 * the setting is on; elsewhere does nothing.
 */
export function createKeepAwake(
  flags = () => keepAwakeFlags(),
  run = (flags: string): ChildProcess =>
    // -w: caffeinate exits with the sidecar, so a crash never leaves the Mac awake.
    spawn("caffeinate", [flags, "-w", String(process.pid)], {
      stdio: "ignore",
    }),
  platform = process.platform,
) {
  let child: ChildProcess | undefined;
  let childFlags: string | undefined;
  let working = false;
  return async (nowWorking: boolean) => {
    if (platform !== "darwin") return;
    working = nowWorking;
    const read = await flags();
    const next = working ? read : null;
    if (child && childFlags !== next) {
      child.kill();
      child = undefined;
    }
    if (next && !child) {
      childFlags = next;
      child = run(next);
      child.on("error", () => (child = undefined));
    }
  };
}
