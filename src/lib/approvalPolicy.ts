/**
 * Which tool calls wait for the user. Manual asks for every call; Auto only
 * for dangerous shell commands and for anything outside the open folder.
 */
import type { ApprovalMode } from "../../shared/hostProtocol.ts";
import { dangerousCommand } from "./dangerousCommands.ts";
import { tildify } from "./paths.ts";

/** Where the session runs; both absolute. */
export type Place = { cwd: string; home: string };

// Built-in tools whose `path` argument names what they read or change.
const FILE_TOOLS = new Set(["read", "edit", "write", "grep", "find", "ls"]);
// Devices every shell script uses; they hold no files.
const HARMLESS = /^\/dev\/(?:null|zero|stdin|stdout|stderr|tty|fd\/\d+)$/;

/** Removes . and .. segments from an absolute path. */
function normalize(path: string): string {
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (part === "..") parts.pop();
    else if (part && part !== ".") parts.push(part);
  }
  return "/" + parts.join("/");
}

/** An absolute path for `path` as pi resolves it: `@` dropped, `~` expanded, relative to cwd. */
export function resolvePath(path: string, { cwd, home }: Place): string {
  const bare = path.replace(/^@/, "");
  const expanded = bare
    .replace(/^~(?=\/|$)/, home)
    .replace(/^\$\{?HOME\}?(?=\/|$)/, home);
  if (expanded.startsWith("/")) return normalize(expanded);
  return normalize(`${cwd}/${expanded}`);
}

/** Whether `path` (absolute) is the folder or inside it. */
export function isInside(path: string, folder: string): boolean {
  return path === folder || path.startsWith(folder.replace(/\/$/, "") + "/");
}

// Words that name a path somewhere else: absolute, home-relative, or
// climbing out with `..`. `--out=/x` counts too.
const PATH_LIKE = /^(?:\/|~|\$\{?HOME\b)|(?:^|\/)\.\.(?:\/|$)/;

/** Paths in a shell command that point outside the open folder. */
export function outsidePaths(command: string, place: Place): string[] {
  const words = command
    .replace(/["'\\]/g, "")
    .split(/[\s;&|()<>`]+/)
    .map((word) => word.replace(/^[^=/~$.]*=/, ""))
    .filter((word) => PATH_LIKE.test(word));
  return words.filter((word) => {
    // A home folder of some other user (~bob) is outside too.
    if (/^~[^/]/.test(word)) return true;
    const path = resolvePath(word, place);
    return !HARMLESS.test(path) && !isInside(path, place.cwd);
  });
}

const outsideReason = (path: string, place: Place) =>
  `Outside the project: ${tildify(path, place.home)}`;

/** Why a call needs approval under Auto, or null when it may run. */
function autoReason(
  toolName: string,
  input: Record<string, unknown>,
  place: Place,
): string | null {
  if (toolName === "bash" && typeof input.command === "string") {
    const danger = dangerousCommand(input.command);
    if (danger) return danger;
    const [outside] = outsidePaths(input.command, place);
    return outside ? outsideReason(outside, place) : null;
  }
  if (FILE_TOOLS.has(toolName) && typeof input.path === "string") {
    const path = resolvePath(input.path, place);
    return isInside(path, place.cwd) ? null : outsideReason(path, place);
  }
  return null;
}

/**
 * Whether a tool call must wait for the user, with the reason to show.
 * Null lets it run.
 */
export function approvalFor(
  mode: ApprovalMode,
  toolName: string,
  input: Record<string, unknown>,
  place: Place,
): { reason?: string } | null {
  if (mode === "manual") return {};
  const reason = autoReason(toolName, input, place);
  return reason === null ? null : { reason };
}

/** The composer's approval modes, as its menu lists them. */
export const APPROVAL_MODES: readonly {
  mode: ApprovalMode;
  label: string;
  description: string;
}[] = [
  {
    mode: "auto",
    label: "Auto",
    description: "Asks only for risky commands and paths outside the folder",
  },
  {
    mode: "manual",
    label: "Manual",
    description: "Asks before every tool call",
  },
];
