import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse as parseToml } from "smol-toml";
import { CHROME_TOOLS } from "../shared/chrome.ts";
import { APP_NAME } from "../src/lib/app.ts";

/** The Chrome tools `[chrome]` in the app's settings leaves on; all by default. */
export async function chromeToolsOn(
  settingsFile = join(homedir(), `.${APP_NAME}`, "settings.toml"),
): Promise<string[]> {
  const all = CHROME_TOOLS.map((t) => t.name as string);
  try {
    const settings = parseToml(await readFile(settingsFile, "utf8"));
    const chrome = settings.chrome as
      { enabled?: unknown; disabled_tools?: unknown } | undefined;
    if (chrome?.enabled === false) return [];
    const off = Array.isArray(chrome?.disabled_tools)
      ? chrome.disabled_tools
      : [];
    return all.filter((name) => !off.includes(name));
  } catch {
    return all;
  }
}
