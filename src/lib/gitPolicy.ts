/**
 * Which git and gh tool calls wait for the user under Auto. Both run outside
 * the sandbox with the user's credentials: reads and local work run, while
 * commits, pushes and changes on GitHub ask.
 */
import {
  outsidePaths,
  outsideReason,
  resolvePath,
  type Place,
} from "./approvalPolicy.ts";
import { dangerousCommand } from "./dangerousCommands.ts";

/** Why `args` would reach outside the folder, or null. */
function outside(args: string[], place: Place): string | null {
  const [path] = outsidePaths("", place, [[{ words: args, redirects: [] }]]);
  return path ? outsideReason(resolvePath(path, place), place) : null;
}

// git's global options that take the next word as their value.
const GLOBAL_WITH_VALUE = new Set(["-C", "-c", "--git-dir", "--work-tree"]);

/** git's global options, subcommand and its arguments, and the folder `-C` points it at. */
export function splitGit(args: string[]) {
  let dir: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (GLOBAL_WITH_VALUE.has(arg)) {
      if (arg === "-C") dir = args[i + 1];
      i++;
    } else if (!arg.startsWith("-")) {
      const globals = args.slice(0, i);
      return { globals, command: arg, rest: args.slice(i + 1), dir };
    }
  }
  return { globals: args, command: undefined, rest: [], dir };
}

// Subcommands that run without asking: they read, or only change the local
// repository, as a sandboxed shell could. Anything else asks.
const GIT_FREE = new Set([
  "status",
  "diff",
  "log",
  "show",
  "blame",
  "shortlog",
  "reflog",
  "grep",
  "rev-parse",
  "rev-list",
  "ls-files",
  "ls-tree",
  "ls-remote",
  "describe",
  "cat-file",
  "merge-base",
  "branch",
  "tag",
  "checkout",
  "switch",
  "restore",
  "add",
  "rm",
  "mv",
  "reset",
  "stash",
  "merge",
  "rebase",
  "cherry-pick",
  "revert",
  "fetch",
  "pull",
  "clone",
  "init",
  "remote",
  "config",
]);

// Options that run a program or set config: global ones, then the subcommand's.
const GLOBAL_RUNS = /^(?:-c|--config-env|--exec-path)(?:=|$)/;
const RUNS_PROGRAM =
  /^(?:--upload-pack|--receive-pack|--template|--config|--exec|--open-files-in-pager)(?:=|$)|^-[^-]*[xO]/;

// `git config` and `git remote` only read in these forms.
const CONFIG_READS = /^(?:--get|--get-all|--get-regexp|--list|-l)$/;
const REMOTE_READS = new Set([undefined, "-v", "--verbose", "show", "get-url"]);

/** Whether a subcommand in GIT_FREE changes git's config instead. */
function writesConfig(command: string, rest: string[]) {
  if (command === "config") return !rest.some((a) => CONFIG_READS.test(a));
  if (command === "remote") return !REMOTE_READS.has(rest[0]);
  // clone -u names the upload-pack program.
  return command === "clone" && rest.includes("-u");
}

/** Why a git call other than commit or push waits, or null to let it run. */
function otherReason(args: string[]): string | null {
  const { globals, command, rest } = splitGit(args);
  if (!command || !GIT_FREE.has(command)) {
    return `Runs git ${command ?? ""}`.trim();
  }
  const runs =
    globals.some((a) => GLOBAL_RUNS.test(a)) ||
    rest.some((a) => RUNS_PROGRAM.test(a));
  return runs || writesConfig(command, rest) ? "Changes how git runs" : null;
}

/** Why a git call waits, and whether it's shown for review; null lets it run. */
export function gitApproval(
  args: string[],
  place: Place,
): { reason: string; review?: "commit" | "push" } | null {
  const words = ["git", ...args];
  const danger = dangerousCommand(words.join(" "), [
    [{ words, redirects: [] }],
  ]);
  if (danger) return { reason: danger };
  const away = outside(args, place);
  if (away) return { reason: away };
  const { command } = splitGit(args);
  if (command === "commit") return { reason: "Commit", review: "commit" };
  if (command === "push") return { reason: "Push", review: "push" };
  const reason = otherReason(args);
  return reason ? { reason } : null;
}
// The only options a task's push may carry; anything else asks.
const TASK_PUSH_OPTIONS = new Set(["-u", "--set-upstream"]);

// Only `-C <dir>` may come before the subcommand (-c and the like run programs).
const onlyDirs = (globals: string[]) =>
  globals.every((a, i) => (i % 2 === 0 ? a === "-C" : true)) &&
  globals.length % 2 === 0;

// `<branch>`, `HEAD` or `src:dst`, where both name `current` (dst never HEAD).
function ownRefspec(spec: string, current: string) {
  const parts = spec.split(":");
  const [src, dst = src === "HEAD" ? current : src] = parts;
  const own = (ref: string) => ref.replace(/^refs\/heads\//, "") === current;
  return parts.length <= 2 && (src === "HEAD" || own(src)) && own(dst);
}

/**
 * Whether a commit or push a task's agent makes runs without asking. Only
 * one form each: a commit with no option that runs a program, and
 * `push [-u] [origin] [<current>|HEAD]` of a branch that isn't
 * `defaultBranch`, main or master. Anything else asks as usual.
 */
export function taskRunsAlone(
  args: string[],
  current: string | null,
  defaultBranch: string | null,
): boolean {
  const { globals, command, rest } = splitGit(args);
  if (!onlyDirs(globals)) return false;
  if (command === "commit") return !rest.some((a) => RUNS_PROGRAM.test(a));
  return command === "push" && ownPush(rest, current, defaultBranch);
}

// A push's words after `push`: plain, to origin, of `current` only.
function ownPush(
  rest: string[],
  current: string | null,
  defaultBranch: string | null,
) {
  if (!current || [defaultBranch, "main", "master"].includes(current)) {
    return false;
  }
  if (rest.some((a) => a.startsWith("-") && !TASK_PUSH_OPTIONS.has(a))) {
    return false;
  }
  const [remote, spec, ...more] = rest.filter((a) => !a.startsWith("-"));
  if (more.length || (remote !== undefined && remote !== "origin")) {
    return false;
  }
  return spec === undefined || ownRefspec(spec, current);
}

// gh commands that only read. Everything else may change something on GitHub.
const GH_READS: Record<string, Set<string>> = {
  pr: new Set(["view", "list", "diff", "status", "checks"]),
  issue: new Set(["view", "list", "status"]),
  repo: new Set(["view", "list", "clone"]),
  run: new Set(["view", "list", "watch"]),
  release: new Set(["view", "list"]),
  workflow: new Set(["view", "list"]),
  auth: new Set(["status"]),
  search: new Set(["repos", "issues", "prs", "code", "commits"]),
};

// `gh api` sends a body (so POSTs) with any of these.
const API_BODY = /^(?:-f|-F|--field|--raw-field|--input)(?:=|$)/;

function apiReads(rest: string[]): boolean {
  if (rest.some((arg) => API_BODY.test(arg))) return false;
  const method = rest.findIndex((a) => /^(?:-X|--method)(?:=|$)/.test(a));
  if (method === -1) return true;
  const value = rest[method].split("=")[1] ?? rest[method + 1];
  return value?.toUpperCase() === "GET";
}

/** Why a gh call waits for the user under Auto; null lets it run. */
export function ghApproval(args: string[], place: Place): string | null {
  const [group, action, ...rest] = args.filter((a) => a !== "--");
  // Only a clone writes files; an api endpoint may start with a slash.
  if (group === "repo" && action === "clone") return outside(rest, place);
  if (group === "api" && apiReads([action ?? "", ...rest])) return null;
  if (GH_READS[group]?.has(action)) return null;
  return "Changes something on GitHub";
}
