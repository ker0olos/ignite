/**
 * What Auto's sandbox needs on Linux and the system may lack: sandbox-runtime
 * refuses to start without bubblewrap and socat. Setup installs them with the
 * distro's package manager, which needs root (sudo asks for the password).
 * Only Node's own modules, so setup runs it before the packages are in.
 */
import { accessSync, constants } from "node:fs";
import { delimiter, join } from "node:path";

const TOOLS = { bwrap: "bubblewrap", socat: "socat" };

// Each package manager's install, in the order they're looked for; the packages share these names on all of them.
const MANAGERS: [string, string[]][] = [
  ["apt-get", ["install", "-y"]],
  ["dnf", ["install", "-y"]],
  ["pacman", ["-S", "--needed", "--noconfirm"]],
  ["zypper", ["--non-interactive", "install"]],
  ["apk", ["add"]],
];

const executable = (path: string) => {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

const onPath = (name: string, path: string, exists = executable) =>
  path
    .split(delimiter)
    .filter(Boolean)
    .some((dir) => exists(join(dir, name)));

/** The packages of the sandbox's tools missing from `path`. */
export function missingPackages(path: string, exists = executable) {
  return Object.entries(TOOLS)
    .filter(([tool]) => !onPath(tool, path, exists))
    .map(([, pkg]) => pkg);
}

/** The command installing `packages` (through sudo unless `root`), or null without a known package manager or sudo. */
export function installCommand(
  packages: string[],
  {
    path,
    root,
    exists = executable,
  }: { path: string; root: boolean; exists?: (p: string) => boolean },
) {
  const found = MANAGERS.find(([name]) => onPath(name, path, exists));
  if (!found) return null;
  const command = [found[0], ...found[1], ...packages];
  if (root) return command;
  return onPath("sudo", path, exists) ? ["sudo", ...command] : null;
}
