/**
 * Packages, installed with pnpm: once per lockfile in ~/.ignite/packages/<hash>,
 * which the clone and every launcher version with that lockfile link to as
 * their node_modules, so setup installs them once and an update with the same
 * packages installs nothing.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  copyFile,
  lstat,
  mkdir,
  readdir,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { APP_NAME } from "../src/lib/app.ts";
import { runTool, type Step } from "./appRun.ts";

const HOME = join(homedir(), `.${APP_NAME}`);
// What decides the installed packages; package.json's scripts don't.
const INPUTS = ["pnpm-lock.yaml", "pnpm-workspace.yaml"];

type Options = { home?: string; step?: Step };
type Ctx = { home: string; step: Step };
const ctxOf = ({ home = HOME, step = () => {} }: Options): Ctx => ({
  home,
  step,
});

async function pinned(dir: string) {
  const { packageManager = "" } = JSON.parse(
    await readFile(join(dir, "package.json"), "utf8"),
  );
  const version = /^pnpm@(\d+\.\d+\.\d+)/.exec(packageManager)?.[1];
  if (!version) throw new Error(`${dir}'s package.json pins no pnpm version`);
  return version;
}

// Installed for the app alone, with npm, so no OS needs admin rights for it (corepack does on Windows).
async function installed(version: string, { home, step }: Ctx) {
  const prefix = join(home, "pnpm", version);
  const exe = process.platform === "win32" ? "pnpm.exe" : "pnpm";
  const bin = join(prefix, "node_modules", "pnpm", exe);
  if (existsSync(bin)) return bin;
  step(`Installing pnpm ${version} for Ignite…`);
  // Its own package.json, so npm installs here rather than in a parent project.
  await mkdir(prefix, { recursive: true });
  await writeFile(join(prefix, "package.json"), "{}");
  // npm is a .cmd on Windows, which only runs through a shell; cwd keeps the path out of it.
  await runTool(
    "npm",
    ["install", "--no-audit", "--no-fund", `pnpm@${version}`],
    {
      cwd: prefix,
      shell: process.platform === "win32",
    },
  );
  return bin;
}

// Runs the pnpm `pinner`'s package.json pins, in `cwd`.
async function pnpm(pinner: string, cwd: string, args: string[], ctx: Ctx) {
  const bin = await installed(await pinned(pinner), ctx);
  await runTool(bin, args, { cwd });
}

const INSTALL = ["install", "--frozen-lockfile", "--prefer-offline"];
const storeDir = (home: string) => join(home, "pnpm-store");

/** Installs `dir`'s packages in place, as in a maintainer's clone, with the pnpm it pins. */
export const pnpmInstall = (dir: string, options: Options = {}) =>
  pnpm(dir, dir, INSTALL, ctxOf(options));

async function lockHash(dir: string) {
  const hash = createHash("sha256");
  for (const file of INPUTS) hash.update(await readFile(join(dir, file)));
  return hash.digest("hex").slice(0, 16);
}

// Marked done last, so a half-finished install is never linked.
async function install(dir: string, into: string, ctx: Ctx) {
  await rm(into, { recursive: true, force: true });
  await mkdir(into, { recursive: true });
  for (const file of INPUTS) await copyFile(join(dir, file), join(into, file));
  const manifest = JSON.parse(
    await readFile(join(dir, "package.json"), "utf8"),
  );
  // No scripts: the folder isn't a checkout for `prepare` to set up.
  delete manifest.scripts;
  await writeFile(join(into, "package.json"), JSON.stringify(manifest));
  // Only what runs and builds the frontend: maintainers' tools stay out.
  const store = ["--store-dir", storeDir(ctx.home)];
  await pnpm(dir, into, [...INSTALL, "--prod", ...store], ctx);
  await writeFile(join(into, "ok"), "");
}

/**
 * Links `dir`'s node_modules to the shared packages for its lockfile,
 * installing them first if none are yet; with `keepOwn`, a node_modules of its
 * own (a maintainer's clone, or one set up before) is brought up to date instead.
 */
export async function linkPackages(
  dir: string,
  { keepOwn = false, ...options }: Options & { keepOwn?: boolean } = {},
) {
  const ctx = ctxOf(options);
  const link = join(dir, "node_modules");
  const own = await lstat(link).then(
    (s) => s.isDirectory(),
    () => false,
  );
  if (keepOwn && own) {
    ctx.step("Updating this clone's own packages…");
    return pnpm(dir, dir, INSTALL, ctx);
  }
  const into = join(ctx.home, "packages", await lockHash(dir));
  if (existsSync(join(into, "ok"))) ctx.step("Packages: already installed.");
  else {
    ctx.step(
      "Installing packages, once per lockfile (the first time downloads about 250 MB)…",
    );
    await install(dir, into, ctx);
  }
  await rm(link, { recursive: true, force: true });
  // A junction on Windows, which needs no admin rights; a symlink elsewhere.
  await symlink(join(into, "node_modules"), link, "junction");
}

// Removes `root`'s folders `keep` turns down; whether it removed any.
async function removeUnkept(
  root: string,
  keep: (name: string, path: string) => boolean,
) {
  const names = await readdir(root).catch(() => [] as string[]);
  const real = names.length ? await realpath(root) : root;
  const gone = names.filter((name) => !keep(name, join(real, name)));
  for (const name of gone)
    await rm(join(real, name), { recursive: true, force: true });
  return gone.length > 0;
}

/**
 * Removes the shared packages none of `checkouts` link to (but unfinished
 * ones while `busy` installs them), the pnpm versions none pins, and with
 * them pnpm's store.
 */
export async function prunePackages(
  checkouts: string[],
  { busy = false, home = HOME } = {},
) {
  const linked = await Promise.all(
    checkouts.map((c) => realpath(join(c, "node_modules")).catch(() => "")),
  );
  const pins = await Promise.all(
    checkouts.map((c) => pinned(c).catch(() => "")),
  );
  await removeUnkept(join(home, "pnpm"), (version) => pins.includes(version));
  const removed = await removeUnkept(
    join(home, "packages"),
    (_, into) =>
      linked.includes(join(into, "node_modules")) ||
      (busy && !existsSync(join(into, "ok"))),
  );
  // The packages left keep their files; `pnpm store prune` would leave its global virtual store behind.
  if (removed && !busy)
    await rm(storeDir(home), { recursive: true, force: true });
}
