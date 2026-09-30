/**
 * Which tool calls wait for the user. Manual asks for every call; Auto only
 * for dangerous shell commands and for anything outside the open folder; YOLO
 * approves all prompts.
 */
import type { ApprovalMode } from "../../shared/hostProtocol.ts";
import {
  dangerousCommand,
  type ParseBash,
  type Pipeline,
} from "./dangerousCommands.ts";
import { tildify } from "./paths.ts";

/** Where the session runs; both absolute. `windows`: they are Windows paths. */
export type Place = { cwd: string; home: string; windows?: boolean };

/** Shell commands on Windows ask in Auto too: no sandbox, and a denylist for Unix. */
export const WINDOWS_SHELL = "Shell commands aren't sandboxed on Windows";
const SHELL_TOOLS = new Set(["bash", "powershell"]);

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

/**
 * A Windows path in a form to compare: forward slashes, lower case (Windows
 * names aren't case sensitive), `c:/…`. A path without a drive is on cwd's.
 */
function windowsPath(path: string, { cwd, home }: Place): string {
  const slash = (p: string) => p.replace(/\\/g, "/");
  let p = slash(path.replace(/^@/, "")).replace(/^~(?=\/|$)/, slash(home));
  if (/^[a-z]:(?!\/)/i.test(p)) p = `${p.slice(0, 2)}/${p.slice(2)}`;
  else if (p.startsWith("/")) p = slash(cwd).slice(0, 2) + p;
  else if (!/^[a-z]:\//i.test(p)) p = `${slash(cwd)}/${p}`;
  const [drive, ...rest] = p.split("/");
  return (drive + normalize(rest.join("/"))).toLowerCase();
}

/** An absolute path for `path` as pi resolves it: `@` dropped, `~` expanded, relative to cwd. */
export function resolvePath(path: string, place: Place): string {
  if (place.windows) return windowsPath(path, place);
  const { cwd, home } = place;
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

/** A command's words and redirect targets, from its pipelines or its raw text. */
function wordsOf(command: string, pipelines?: Pipeline[] | null): string[] {
  if (!pipelines) {
    return command.replace(/["'\\]/g, "").split(/[\s;&|()<>`]+/);
  }
  return pipelines
    .flat()
    .flatMap(({ words, redirects }) => [
      ...words,
      ...redirects.map((r) => r.target),
    ]);
}

/** Paths in a shell command (parsed into `pipelines` if given) that point outside the open folder. */
export function outsidePaths(
  command: string,
  place: Place,
  pipelines?: Pipeline[] | null,
): string[] {
  const words = wordsOf(command, pipelines)
    .map((word) => word.replace(/^[^=/~$.]*=/, ""))
    .filter((word) => PATH_LIKE.test(word));
  return words.filter((word) => {
    // A home folder of some other user (~bob) is outside too.
    if (/^~[^/]/.test(word)) return true;
    const path = resolvePath(word, place);
    return !HARMLESS.test(path) && !isInside(path, place.cwd);
  });
}

/** "Outside the project: ~/x" for a path that resolved outside the folder. */
export const outsideReason = (path: string, place: Place) =>
  `Outside the project: ${tildify(path, resolvePath(place.home, place))}`;

/** Why a file tool call needs approval under Auto, or null when it may run. */
function fileReason(path: string, place: Place): string | null {
  const resolved = resolvePath(path, place);
  const inside = isInside(resolved, resolvePath(place.cwd, place));
  return inside ? null : outsideReason(resolved, place);
}

/** How shell commands are judged under Auto. */
export type BashCheck = {
  /** Splits commands for a precise check; without it, the raw text is checked. */
  parse?: ParseBash;
  /** Commands run in the OS sandbox, which keeps them in the folder itself. */
  sandboxed?: boolean;
};

/** Why a shell command needs approval under Auto, or null when it may run. */
function bashReason(
  command: string,
  place: Place,
  { parse, sandboxed }: BashCheck,
): string | null {
  const pipelines = parse?.(command);
  const danger = dangerousCommand(command, pipelines);
  if (danger || place.windows) return danger ?? WINDOWS_SHELL;
  if (sandboxed) return null;
  const [outside] = outsidePaths(command, place, pipelines);
  return outside ? outsideReason(outside, place) : null;
}

/** Why a call needs approval under Auto, or null when it may run. */
function autoReason(
  toolName: string,
  input: Record<string, unknown>,
  place: Place,
  bash: BashCheck,
): string | null {
  if (toolName === "bash" && typeof input.command === "string") {
    return bashReason(input.command, place, bash);
  }
  if (place.windows && SHELL_TOOLS.has(toolName)) return WINDOWS_SHELL;
  if (FILE_TOOLS.has(toolName) && typeof input.path === "string") {
    return fileReason(input.path, place);
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
  bash: BashCheck = {},
): { reason?: string } | null {
  if (mode === "manual") return {};
  if (mode === "yolo") return null;
  const reason = autoReason(toolName, input, place, bash);
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
  {
    mode: "yolo",
    label: "YOLO",
    description: "Approves everything, retrying sandbox blocks outside it",
  },
];
