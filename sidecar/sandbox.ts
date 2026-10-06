/**
 * Runs Auto mode's shell commands inside an OS sandbox (Seatbelt on macOS,
 * bubblewrap on Linux) through Anthropic's sandbox-runtime: writes only in the
 * project, temp folders and package caches, no reading credentials, network
 * only to package registries and git hosts.
 */
import {
  SandboxManager,
  type SandboxRuntimeConfig,
} from "@anthropic-ai/sandbox-runtime";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { APP_NAME } from "../src/lib/app.ts";
import {
  allowedFile,
  loadAllowed,
  NOTHING_ALLOWED,
  type Allowed,
  type AllowRule,
} from "./sandboxAllow.ts";
import { gitAccess } from "./worktreeGit.ts";

// ponytail: fixed lists; make them settings once someone needs another host
// or cache.
/** Hosts sandboxed commands may reach: package registries and git hosts. */
export const ALLOWED_DOMAINS = [
  "registry.npmjs.org",
  "registry.yarnpkg.com",
  "jsr.io",
  "pypi.org",
  "files.pythonhosted.org",
  "crates.io",
  "index.crates.io",
  "static.crates.io",
  "proxy.golang.org",
  "sum.golang.org",
  "rubygems.org",
  "index.rubygems.org",
  "github.com",
  "*.github.com",
  "*.githubusercontent.com",
  "gitlab.com",
  "bitbucket.org",
];

/** Secrets under the home folder that sandboxed commands can't read. */
const CREDENTIALS = [
  ".ssh",
  ".aws",
  ".gnupg",
  ".kube",
  ".azure",
  ".config/gcloud",
  ".config/gh",
  ".docker/config.json",
  ".netrc",
  ".git-credentials",
  ".pypirc",
  "Library/Keychains",
  ".codex/auth.json",
  ".claude/.credentials.json",
  `.${APP_NAME}/pi/auth.json`,
];

// Programs that run whatever they're given (versioned too: python3.12) or
// copy any file anywhere: always running them outside would turn the sandbox off.
const RUNS_ANYTHING =
  /^(?:(?:ba|z|da|k|c|tc|fi)?sh|env|sudo|doas|xargs|nohup|nice|time|timeout|watch|script|exec|command|eval|source|make|find|(?:g|m|n)?awk|ssh|docker|podman|kubectl|osascript|open|(?:node|deno|bun|python|ruby|perl|php|lua|java|pip|go)[\d.]*|npm|npx|pnpm|pnpx|yarn|bunx|tsx|ts-node|uv|uvx|cargo|rustc|gcc|clang|cat|cp|mv|ln|dd|tar|zip|unzip|rsync|scp|curl|wget|nc|head|tail|less|more|grep|rg|sed|base64|xxd|od|strings|security)$/;

/** Whether `path` is one of the credentials sandboxed commands can't read. */
export function isCredential(path: string, home: string): boolean {
  return CREDENTIALS.map((p) => join(home, p)).some(
    (p) => path === p || path.startsWith(p + "/"),
  );
}

/**
 * Whether "Always allow" is worth offering for `rule`: never for credentials
 * or programs that run anything, and not again once saved, since the
 * sandbox's own protections (a worktree's git files, shell rc files) outrank
 * the allowlist.
 */
export async function canAllow(rule: AllowRule, home: string) {
  if (isCredential(rule.target, home)) return false;
  if (rule.kind === "commands" && RUNS_ANYTHING.test(rule.target.split(" ")[0]))
    return false;
  const allowed = await loadAllowed(allowedFile(home));
  return !allowed[rule.kind].includes(rule.target);
}

/** Package manager caches under the home folder, which installs write to. */
const CACHES = [
  ".npm",
  ".cache",
  "Library/Caches",
  ".cargo/registry",
  ".cargo/git",
  "go/pkg/mod",
  ".bun/install/cache",
  ".pnpm-store",
  "Library/pnpm",
  ".yarn",
  ".gradle/caches",
  ".m2/repository",
];

/**
 * The sandbox for commands run in `cwd`, with what the user always allows.
 * In an agent's worktree, git also writes its private git dir and objects in
 * the user's repository, but never the files that say which repository that
 * is (see gitAccess). `inFolder` is where it may write in `cwd`: all of it,
 * or only what git ignores while the work isn't planned.
 */
export function sandboxConfig(
  cwd: string,
  home: string,
  allowed: Allowed = NOTHING_ALLOWED,
  inFolder: string[] = [cwd],
): SandboxRuntimeConfig {
  const temp = [...new Set([tmpdir(), "/tmp", "/private/tmp"])];
  const git = gitAccess(cwd);
  return {
    network: {
      allowedDomains: [...ALLOWED_DOMAINS, ...allowed.hosts],
      deniedDomains: [],
      allowUnixSockets: allowed.sockets,
    },
    filesystem: {
      denyRead: CREDENTIALS.map((p) => join(home, p)),
      allowRead: allowed.read,
      allowWrite: [
        ...inFolder,
        ...git.allow,
        ...temp,
        ...CACHES.map((p) => join(home, p)),
        ...allowed.write,
      ],
      denyWrite: git.deny,
    },
    // macOS denies this to every sandboxed process; it breaks nothing.
    ignoreViolations: { "*": ["kern.iossupportversion"] },
  };
}

/** The sandbox's report line for the file or network denial it logged first. */
function blockedLine(output: string): string | undefined {
  const report = /<sandbox_violations>\s*([\s\S]*?)<\/sandbox_violations>/.exec(
    output,
  );
  const lines = report?.[1].split("\n").filter((line) => line.trim()) ?? [];
  // macOS also logs lookups (system-info, mach-lookup) that commands failing
  // for their own reasons made, e.g. a grep with no match; only a file or
  // network denial is worth asking to run outside the sandbox.
  return lines.find((l) => /file-|network/.test(l));
}

/** The program the sandbox blocked ("doppler(123) deny(1) …" → doppler); null if unnamed. */
export function blockedProgram(output: string): string | null {
  return /^(\S+)\(\d+\)\s+deny/.exec(blockedLine(output) ?? "")?.[1] ?? null;
}

/** What the sandbox blocked, from output `explain` annotated; null if nothing. */
export function blockedSummary(output: string): string | null {
  const first = blockedLine(output);
  // "touch(123) deny(1) file-write-create /path" → "file-write-create /path",
  // and the proxy's "deny network-outbound host:443 (…)" → "network-outbound …".
  return first
    ? first.replace(/^(?:\S+\(\d+\)\s+)?deny(?:\(\d+\))?\s+/, "").trim()
    : null;
}

const BLOCKED_VERBS: [RegExp, string][] = [
  [/^file-read/, "read"],
  [/^file-write-create$/, "create"],
  [/^file-write-unlink$/, "delete"],
  [/^file-write/, "write to"],
  [/^network/, "connect to"],
];

/** A `blockedSummary` in plain words ("read ~/.ssh/config"); null if it isn't one. */
export function blockedAction(summary: string, home: string): string | null {
  const [, op, target] = /^(\S+) (.+)$/.exec(summary) ?? [];
  const verb = op && BLOCKED_VERBS.find(([re]) => re.test(op))?.[1];
  if (!verb) return null;
  return `${verb} ${shortHome(target, home)}`;
}

/** Why a command the sandbox blocked waits for the user. */
export function blockedReason(what: string, home = homedir()) {
  const action = blockedAction(what, home);
  return action ? `Tried to ${action}` : `Blocked by the sandbox: ${what}`;
}

/** `path` with `home` shown as ~. */
export function shortHome(path: string, home: string): string {
  return path.startsWith(home + "/") ? "~" + path.slice(home.length) : path;
}

/**
 * The line where a failed command says the OS refused it. The sandbox's own
 * report can arrive too late (macOS logs it after the command ends), but a
 * refused file operation always says so in the command's output.
 */
export function refusedLine(output: string): string | null {
  const line = output
    .split("\n")
    .find((l) => /operation not permitted|read-only file system/i.test(l));
  return line ? line.trim() : null;
}

/**
 * Whether a command that exited 0 may still have been blocked: a pipe
 * (`docker ps 2>&1 | head`) hides the failure but not the refusal.
 */
export function mayBeBlocked(output: string): boolean {
  return /operation not permitted|permission denied|read-only file system/i.test(
    output,
  );
}

/**
 * `annotate(output)` once the sandbox's report shows up: macOS logs it a
 * moment after the command ends. Gives up after `tries`, returning `output`.
 */
export async function explainWhenReported(
  annotate: (output: string) => string,
  output: string,
  { tries = 10, delay = 50 } = {},
): Promise<string> {
  for (let i = 1; ; i++) {
    const explained = annotate(output);
    if (explained !== output || i >= tries) return explained;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

export type Sandbox = {
  /** `command` rewritten to run in the sandbox for `cwd`, writing there only in `inFolder` if given; `id` names this run. */
  wrap(
    command: string,
    cwd: string,
    id: string,
    inFolder?: string[],
  ): Promise<string>;
  /** A failed run's `output` with what the sandbox blocked appended, if anything. */
  explain(id: string, output: string): Promise<string>;
};

/**
 * Starts the sandbox (its network proxy runs in this process). Undefined
 * where it can't run, e.g. Linux without bubblewrap; commands then run as
 * before, with approval asked for paths outside the folder instead.
 */
export async function createSandbox(
  home = homedir(),
): Promise<Sandbox | undefined> {
  if (!["darwin", "linux"].includes(process.platform)) return undefined;
  if (!SandboxManager.isSupportedPlatform()) return undefined;
  const { errors } = SandboxManager.checkDependencies();
  if (errors.length) throw new Error(errors.join("; "));
  // Each command gets its folder's rules in wrap(); until then, only temp.
  await SandboxManager.initialize(
    sandboxConfig(tmpdir(), home),
    undefined,
    true,
  );
  return {
    // pipefail: agents pipe through head/tail, which would hide a block.
    // Hosts and sockets are the proxy's and profile's global config, so the
    // allowlist goes there too; it's cheap to swap.
    wrap: async (command, cwd, id, inFolder) => {
      const allowed = await loadAllowed(allowedFile(home));
      SandboxManager.updateConfig(sandboxConfig(tmpdir(), home, allowed));
      return SandboxManager.wrapWithSandbox(
        `set -o pipefail; ${command}`,
        undefined,
        { filesystem: sandboxConfig(cwd, home, allowed, inFolder).filesystem },
        undefined,
        { commandId: id },
      );
    },
    explain: (id, output) =>
      explainWhenReported(
        (text) => SandboxManager.annotateStderrWithSandboxFailures(id, text),
        output,
      ),
  };
}
