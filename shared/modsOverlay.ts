import { existsSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative, sep } from "node:path";

/** The repo checkout, and the folder whose files replace its files by path. */
export type Overlay = { root: string; mods: string };

// Config, Rust and dependencies stay upstream's.
const OVERRIDABLE = ["src", "sidecar", "shared"];

function inside(dir: string, file: string): string | null {
  const rel = relative(dir, file);
  if (!rel || isAbsolute(rel) || rel === ".." || rel.startsWith(".." + sep))
    return null;
  return rel;
}

// Loaders see real paths, so symlinks (macOS's /var, /tmp) must be resolved.
function real(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

/** Reads the overlay from IGNITION_MODS; null when unset (maintainers). */
export function overlayFromEnv(root: string): Overlay | null {
  const mods = process.env.IGNITION_MODS;
  return mods ? { root: real(root), mods: real(mods) } : null;
}

/** The mods/ file that replaces `file`, or null when it isn't overridden. */
export function overrideFor(overlay: Overlay, file: string): string | null {
  const rel = inside(overlay.root, file);
  if (!rel || !OVERRIDABLE.includes(rel.split(sep)[0])) return null;
  const twin = join(overlay.mods, rel);
  return existsSync(twin) ? twin : null;
}

/** The repo file a mods/ file stands in for, so its imports resolve like the original's. */
export function originalOf(overlay: Overlay, file: string): string | null {
  const rel = inside(overlay.mods, file);
  return rel ? join(overlay.root, rel) : null;
}
