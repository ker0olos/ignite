/** `npm run setup`'s steps that need the packages (launcher/setup.mjs runs them once they're in). */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parse, stringify } from "smol-toml";
import { APP_NAME } from "../src/lib/app.ts";
import { ASSETS } from "./appBinary.ts";

/** Whether this machine builds the binary itself: CI builds none for it. */
export const buildsBinary = (machine = `${process.platform}-${process.arch}`) =>
  !ASSETS[machine];

/** Turns on `[approval] windows_sandbox` in the settings, keeping the rest. */
export async function enableWindowsSandbox(home: string) {
  const file = join(home, `.${APP_NAME}`, "settings.toml");
  const text = await readFile(file, "utf8").catch(() => "");
  let settings: Record<string, unknown> = {};
  try {
    settings = parse(text);
  } catch {
    // Unreadable settings: the app fills in the rest, as with none.
  }
  const approval = (settings.approval ?? {}) as Record<string, unknown>;
  settings.approval = { ...approval, windows_sandbox: true };
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, stringify(settings));
}
