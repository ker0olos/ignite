/** The `[approval]` settings, read on every tool call, and the sandbox they pick. */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse as parseToml } from "smol-toml";
import { APP_NAME } from "../src/lib/app.ts";
import type { ApprovalGate } from "../src/lib/approvalPolicy.ts";
import { createSandbox } from "./sandbox.ts";
import { createWindowsSandbox } from "./windowsSandbox.ts";

const windows = () => process.platform === "win32";

/** settings.toml's `[approval]`; empty when it can't be read. */
async function approvalSettings(
  settingsFile = join(homedir(), `.${APP_NAME}`, "settings.toml"),
): Promise<Record<string, unknown>> {
  try {
    const settings = parseToml(await readFile(settingsFile, "utf8"));
    return (settings.approval ?? {}) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** How tool calls are gated: "manual" when set, "full" for Auto with `full_access`, else "auto". */
export async function approvalMode(
  settingsFile?: string,
): Promise<ApprovalGate> {
  const approval = await approvalSettings(settingsFile);
  if (approval.mode === "manual") return "manual";
  return approval.full_access === true ? "full" : "auto";
}

const startSandbox = () =>
  (windows() ? createWindowsSandbox() : createSandbox()).catch(
    (error: unknown) => {
      process.stderr.write(`pi-host: sandbox unavailable: ${error}\n`);
      return undefined;
    },
  );
// Windows' needs a one-time setup (a UAC prompt), so it starts once turned on.
let sandbox = windows() ? undefined : startSandbox();

/** The sandbox for this call; on Windows, only while `windows_sandbox` is on. */
export async function currentSandbox() {
  if (windows()) {
    if ((await approvalSettings()).windows_sandbox !== true) {
      // Turning it off and on again retries a setup that failed (UAC declined).
      if (sandbox && !(await sandbox)) sandbox = undefined;
      return undefined;
    }
    sandbox ??= startSandbox();
  }
  return sandbox;
}

/** Whether commands are sandboxed, without starting Windows' (its setup asks for admin rights). */
export async function sandboxing(): Promise<boolean> {
  if (windows()) return (await approvalSettings()).windows_sandbox === true;
  return !!(await sandbox);
}
