import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse as parseToml } from "smol-toml";
import { APP_NAME } from "../src/lib/app.ts";

/** What the agent learns besides its memory, each with its own switch in Settings. */
export type Learning = "lessons" | "reflector" | "procedures";

/** Whether `[<kind>] enabled` in the app's settings leaves it on: recording new ones and using them. On by default. */
export async function learningOn(
  kind: Learning,
  settingsFile = join(homedir(), `.${APP_NAME}`, "settings.toml"),
): Promise<boolean> {
  try {
    const settings = parseToml(await readFile(settingsFile, "utf8"));
    const section = settings[kind] as { enabled?: unknown } | undefined;
    return section?.enabled !== false;
  } catch {
    return true;
  }
}
