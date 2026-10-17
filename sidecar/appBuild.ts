/**
 * The versions the launcher (launcher/launch.mjs) runs: each a git worktree of
 * the user's clone in ~/.ignite/app/<commit>, built once (a release binary,
 * the frontend once per set of mods), so opening the app builds nothing.
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, relative } from "node:path";
import { promisify } from "node:util";
import { APP_NAME, APP_TITLE } from "../src/lib/app.ts";
import { downloadBinary } from "./appBinary.ts";
import { CLONE_FLAGS } from "./worktreeClone.ts";
import { git } from "./worktreeGit.ts";

const exec = promisify(execFile);
const home = join(homedir(), `.${APP_NAME}`);
/** Each version's folder, and the Cargo builds they share. */
export const APPS = join(home, "app");
/** The launcher's log and state: good, bad and next commits, healthy, restart. */
export const LAUNCH = join(home, "launch");
// Thin LTO: a first build in minutes, not ten; the Rust side only registers plugins.
const PROFILE = "app";
const EXE = process.platform === "win32" ? "ignite.exe" : "ignite";

async function run(cmd: string, args: string[], cwd: string, env = {}) {
  // npm is a .cmd on Windows, which only runs through a shell.
  const shell = process.platform === "win32" && cmd === "npm";
  await exec(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    maxBuffer: 1 << 26,
    shell,
  });
}

/** Where commit `sha` is built. */
export const versionDir = (sha: string) => join(APPS, sha);
const buildDir = (dir: string) => join(dir, "build");

/** A version's executable; on macOS inside a minimal bundle, so Stage Manager shows its icon. */
export function binaryOf(dir: string) {
  return process.platform === "darwin"
    ? join(buildDir(dir), `${APP_TITLE}.app`, "Contents", "MacOS", EXE)
    : join(buildDir(dir), EXE);
}

/** Whether a version finished building. */
export const isBuilt = (dir: string) => existsSync(join(buildDir(dir), "ok"));

/** The env Vite builds or serves the frontend with: these mods, the launcher's health file. */
export function viteEnv(mods: string) {
  return {
    IGNITE_MODS: mods,
    IGNITE_HEALTH_FILE: join(LAUNCH, "healthy"),
    IGNITE_LIVE_RELOAD: "1",
  };
}

/** Mods paths that aren't mods: git, dependencies, Finder's files. */
export const SKIP = /(^|[/\\])(\.git|node_modules|\.DS_Store)([/\\]|$)/;

/** Names a set of mods by its files' paths, sizes and times; "plain" for none. */
export async function modsHash(mods: string): Promise<string> {
  const entries = mods
    ? await readdir(mods, { recursive: true, withFileTypes: true }).catch(
        () => [],
      )
    : [];
  const files = entries
    .filter((e) => e.isFile())
    .map((e) => relative(mods, join(e.parentPath, e.name)))
    .filter((f) => !SKIP.test(f))
    .sort();
  if (!files.length) return "plain";
  const hash = createHash("sha1");
  for (const f of files) {
    // Editors' temporary files can go between listing and reading them.
    const info = await stat(join(mods, f)).catch(() => null);
    if (info) hash.update(`${f}\0${info.size}\0${info.mtimeMs}\n`);
  }
  return hash.digest("hex").slice(0, 12);
}

/** The version's frontend built with these mods: built now (a few seconds) if this set wasn't. */
export async function ensureDist(dir: string, mods: string): Promise<string> {
  const name = `dist-${await modsHash(mods)}`;
  const out = join(buildDir(dir), name);
  if (existsSync(out)) return out;
  const vite = join(dir, "node_modules", "vite", "bin", "vite.js");
  const args = [vite, "build", "--outDir", `${out}.tmp`, "--emptyOutDir"];
  await run(process.execPath, args, dir, viteEnv(mods));
  await rename(`${out}.tmp`, out);
  for (const old of await readdir(buildDir(dir))) {
    if (old.startsWith("dist-") && old !== name)
      await rm(join(buildDir(dir), old), { recursive: true, force: true });
  }
  return out;
}

const PLIST = (name: string) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key><string>${EXE}</string>
  <key>CFBundleIdentifier</key><string>dev.${EXE}</string>
  <key>CFBundleName</key><string>${name}</string>
  <key>CFBundleIconFile</key><string>icon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSAppSleepDisabled</key><true/>
</dict>
</plist>
`;

async function placeBinary(dir: string, from: string) {
  const to = binaryOf(dir);
  await mkdir(dirname(to), { recursive: true });
  await copyFile(from, to);
  if (process.platform !== "darwin") return;
  const contents = dirname(dirname(to));
  await mkdir(join(contents, "Resources"), { recursive: true });
  const icon = join(dir, "src-tauri", "icons", "icon.icns");
  await copyFile(icon, join(contents, "Resources", "icon.icns"));
  await writeFile(join(contents, "Info.plist"), PLIST(APP_TITLE));
}

// Without Tauri's custom-protocol feature the binary loads localhost:1420,
// where the launcher serves the frontend, so it holds no frontend of its own.
async function buildBinary(dir: string, why: string) {
  const target = join(APPS, "target");
  try {
    await run(
      "cargo",
      ["build", "--profile", PROFILE, "--features", "no-console"],
      join(dir, "src-tauri"),
      { CARGO_TARGET_DIR: target },
    );
  } catch (error) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
    throw new Error(
      `There's no prebuilt binary to use (${why}), and building one needs Rust: https://rustup.rs`,
      { cause: error },
    );
  }
  return join(target, PROFILE, EXE);
}

/** The version's binary: CI's verified one for its src-tauri/, else built here. */
async function makeBinary(dir: string) {
  const downloads = join(buildDir(dir), "download");
  const got = await downloadBinary(dir, downloads);
  await placeBinary(
    dir,
    "file" in got ? got.file : await buildBinary(dir, got.why),
  );
  await rm(downloads, { recursive: true, force: true });
}

async function sameFile(a: string, b: string) {
  const [x, y] = await Promise.all([readFile(a), readFile(b)]);
  return x.equals(y);
}

// Copy-on-write where the filesystem can clone (1 GB for almost nothing), else a fresh install.
async function installPackages(dir: string, from: string) {
  const source = join(from, "node_modules");
  const flags = CLONE_FLAGS[process.platform];
  const lock = "package-lock.json";
  if (
    flags &&
    existsSync(source) &&
    (await sameFile(join(from, lock), join(dir, lock)))
  ) {
    const cloned = await exec("cp", [...flags, source, dir])
      .then(() => true)
      .catch(() => false);
    if (cloned) return;
  }
  await rm(join(dir, "node_modules"), { recursive: true, force: true });
  await run("npm", ["ci", "--no-audit", "--no-fund"], dir);
}

async function sameRust(clone: string, from: string, sha: string) {
  const head = await git(from, ["rev-parse", "HEAD"]);
  return git(clone, ["diff", "--quiet", head, sha, "--", "src-tauri"])
    .then(() => true)
    .catch(() => false);
}

/** Removes a version's worktree and folder; a missing one is fine. */
export async function removeVersion(clone: string, dir: string) {
  await git(clone, ["worktree", "remove", "--force", dir]).catch(() => {});
  await rm(dir, { recursive: true, force: true });
  await git(clone, ["worktree", "prune"]).catch(() => {});
}

/**
 * Builds commit `sha` of the clone into its own folder, reusing what it can
 * from the checkout `from` (its packages, and its binary when the Rust side
 * didn't change; else CI's, else built here), with the frontend for `mods`.
 */
export async function buildVersion(
  clone: string,
  sha: string,
  from: string,
  mods: string,
): Promise<string> {
  const dir = versionDir(sha);
  if (isBuilt(dir)) return dir;
  await removeVersion(clone, dir);
  await mkdir(APPS, { recursive: true });
  await git(clone, ["worktree", "add", "--detach", dir, sha]);
  try {
    await installPackages(dir, from);
    const binary = binaryOf(from);
    if (existsSync(binary) && (await sameRust(clone, from, sha)))
      await placeBinary(dir, binary);
    else await makeBinary(dir);
    await ensureDist(dir, mods);
  } catch (error) {
    await removeVersion(clone, dir);
    throw error;
  }
  await writeFile(join(buildDir(dir), "ok"), "");
  return dir;
}
