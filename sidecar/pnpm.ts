/**
 * Installs packages with pnpm, which links them from its store: a launcher
 * version's install takes seconds, where npm's took minutes on Windows.
 */
import { exec, execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { APP_NAME } from "../src/lib/app.ts";

async function pinned(dir: string) {
  const { packageManager = "" } = JSON.parse(
    await readFile(join(dir, "package.json"), "utf8"),
  );
  const version = /^pnpm@(\d+\.\d+\.\d+)/.exec(packageManager)?.[1];
  if (!version) throw new Error(`${dir}'s package.json pins no pnpm version`);
  return version;
}

// Installed for the app alone, with npm, so no OS needs admin rights for it (corepack does on Windows).
async function installed(version: string, home: string) {
  const prefix = join(home, "pnpm", version);
  const exe = process.platform === "win32" ? "pnpm.exe" : "pnpm";
  const bin = join(prefix, "node_modules", "pnpm", exe);
  if (existsSync(bin)) return bin;
  // npm is a .cmd on Windows, which only runs through a shell.
  await promisify(exec)(
    `npm install --prefix "${prefix}" --no-audit --no-fund pnpm@${version}`,
  );
  return bin;
}

/** Installs `dir`'s packages from its lockfile with the pnpm it pins, installed first if this machine lacks it. */
export async function pnpmInstall(
  dir: string,
  home = join(homedir(), `.${APP_NAME}`),
) {
  const bin = await installed(await pinned(dir), home);
  await promisify(execFile)(
    bin,
    ["install", "--frozen-lockfile", "--prefer-offline"],
    { cwd: dir, maxBuffer: 1 << 26 },
  );
}
