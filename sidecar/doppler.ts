// Doppler keys a folder's project and config by its path, which a worktree lacks:
// shells there get DOPPLER_CONFIG_DIR at a copy of the user's config naming the worktree too.
import type { BashSpawnHook } from "@earendil-works/pi-coding-agent";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, relative } from "node:path";
import { parse, stringify } from "yaml";
import { APP_NAME } from "../src/lib/app.ts";
import { folderOf, within, worktreeOf, WORKTREES } from "./worktreeGit.ts";

type Scopes = Record<string, Record<string, unknown>>;
type Config = { scoped?: Scopes };

// Not in the temp folder: sandboxed commands mustn't write what unsandboxed shells read.
const configDir = (worktree: string, home: string) =>
  join(
    home,
    `.${APP_NAME}`,
    "doppler",
    createHash("sha256").update(worktree).digest("hex").slice(0, 16),
  );

function userConfig(home: string): Config | null {
  const dir = process.env.DOPPLER_CONFIG_DIR || join(home, ".doppler");
  try {
    const config: unknown = parse(
      readFileSync(join(dir, ".doppler.yaml"), "utf8"),
    );
    return config && typeof config === "object" ? (config as Config) : null;
  } catch {
    return null;
  }
}

/** The settings of `folder` and what's in it, at the same places in `worktree`; ancestors' (which Doppler applies by prefix) merged onto its root. */
function mapScopes(scoped: Scopes, folder: string, worktree: string): Scopes {
  const mapped: Scopes = {};
  // Shortest first, so a deeper scope's fields win, as in Doppler.
  const paths = Object.keys(scoped).sort((a, b) => a.length - b.length);
  for (const path of paths) {
    const key = within(path, folder)
      ? join(worktree, relative(folder, path))
      : within(folder, path) && worktree;
    if (key) mapped[key] = { ...mapped[key], ...scoped[path] };
  }
  return mapped;
}

function writeCopy(out: string, text: string) {
  const file = join(out, ".doppler.yaml");
  try {
    if (readFileSync(file, "utf8") === text) return;
  } catch {
    // Not written yet.
  }
  mkdirSync(out, { recursive: true, mode: 0o700 });
  // Renamed into place: another shell's Doppler may be reading it.
  const temp = `${file}.${process.pid}`;
  writeFileSync(temp, text, { mode: 0o600 });
  renameSync(temp, file);
}

/** For a `dir` in an agent's worktree whose folder has Doppler settings, the env pointing Doppler at its copy; else none. */
export function dopplerEnv(
  dir: string,
  home = homedir(),
  root = WORKTREES,
): Record<string, string> {
  const worktree = worktreeOf(dir, root);
  const config = worktree ? userConfig(home) : null;
  if (!worktree || !config?.scoped) return {};
  const mapped = mapScopes(config.scoped, folderOf(worktree, root), worktree);
  if (!Object.keys(mapped).length) return {};
  const out = configDir(worktree, home);
  const scoped = { ...config.scoped, ...mapped };
  try {
    writeCopy(out, stringify({ ...config, scoped }));
  } catch {
    // ponytail: no copy, no Doppler settings in the worktree; never a failed spawn.
    return {};
  }
  return { DOPPLER_CONFIG_DIR: out };
}

/** `hook` (if any), then Doppler's env for the command's cwd. */
export const withDoppler =
  (hook?: BashSpawnHook, home?: string, root?: string): BashSpawnHook =>
  (context) => {
    const next = hook ? hook(context) : context;
    const env = dopplerEnv(next.cwd, home, root);
    return { ...next, env: { ...next.env, ...env } };
  };

/** Deletes `worktree`'s copy of the Doppler config. */
export const dropDoppler = (worktree: string, home = homedir()) =>
  rmSync(configDir(worktree, home), { recursive: true, force: true });
