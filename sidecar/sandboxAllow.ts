/**
 * What the user chose to always let sandboxed commands do, beyond the
 * sandbox's own rules: hosts, Unix sockets, paths to read or write, and
 * programs whose commands run outside it.
 * Kept in ~/.ignite/sandbox.json, read before every sandboxed command.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { APP_NAME } from "../src/lib/app.ts";
import type { Pipeline } from "../src/lib/dangerousCommands.ts";

export type Allowed = {
  hosts: string[];
  sockets: string[];
  read: string[];
  write: string[];
  commands: string[];
};

/** One thing to always allow: which list it goes in, and what. */
export type AllowRule = { kind: keyof Allowed; target: string };

export const NOTHING_ALLOWED: Allowed = {
  hosts: [],
  sockets: [],
  read: [],
  write: [],
  commands: [],
};

/** Where the allowlist lives for `home`. */
export function allowedFile(home = homedir()): string {
  return join(home, `.${APP_NAME}`, "sandbox.json");
}

const strings = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];

/** The allowlist; empty when the file is missing or unreadable. */
export async function loadAllowed(file = allowedFile()): Promise<Allowed> {
  try {
    const data = JSON.parse(await readFile(file, "utf8")) as Partial<Allowed>;
    return {
      hosts: strings(data.hosts),
      sockets: strings(data.sockets),
      read: strings(data.read),
      write: strings(data.write),
      commands: strings(data.commands),
    };
  } catch {
    return NOTHING_ALLOWED;
  }
}

// Extensions load afresh for every session, so the save queue that keeps two
// answers from overwriting each other lives on globalThis.
const SAVING = Symbol.for(`${APP_NAME}.sandboxAllow`);
const shared = globalThis as { [key: symbol]: Promise<void> | undefined };

/** Adds `rule` to the allowlist, once; saves run one at a time. */
export function allowAlways(
  rule: AllowRule,
  file = allowedFile(),
): Promise<void> {
  const saved = (shared[SAVING] ?? Promise.resolve()).then(() =>
    save(rule, file),
  );
  shared[SAVING] = saved.catch(() => {});
  return saved;
}

async function save(rule: AllowRule, file: string) {
  const allowed = await loadAllowed(file);
  if (allowed[rule.kind].includes(rule.target)) return;
  const next = {
    ...allowed,
    [rule.kind]: [...allowed[rule.kind], rule.target],
  };
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(next, null, 2) + "\n");
}

/**
 * The rule that lets a `blockedSummary` through next time
 * ("network-outbound /x.sock", "network-outbound host:443 (…)",
 * "file-read-data /path"); null for anything else.
 */
export function allowRuleFor(summary: string): AllowRule | null {
  const [, op, target] = /^(\S+) (.+)$/.exec(summary) ?? [];
  if (!op) return null;
  if (op.startsWith("file-read")) return { kind: "read", target };
  if (op.startsWith("file-write")) return { kind: "write", target };
  if (op !== "network-outbound") return null;
  if (target.startsWith("/")) return { kind: "sockets", target };
  const host = target.split(" ")[0].replace(/:\d+$/, "");
  return host ? { kind: "hosts", target: host } : null;
}

const isCd = (pipeline: Pipeline) => pipeline[0]?.words[0] === "cd";

/**
 * A pipeline's first command run by name from PATH, with its subcommand
 * ("doppler run"); null for `./x`, `/bin/x` or `PATH=. x`.
 */
function commandOf([first]: Pipeline): string | null {
  const [program, sub] = first?.words ?? [];
  if (!program || /[/=]/.test(program)) return null;
  return sub && /^[a-z][\w-]*$/.test(sub) ? `${program} ${sub}` : program;
}

/** Whether the pipeline's first command starts with `command`'s words. */
function startsWith(pipeline: Pipeline, command: string): boolean {
  const words = pipeline[0]?.words ?? [];
  return (
    !/[/=]/.test(words[0] ?? "/") &&
    command.split(" ").every((word, i) => words[i] === word)
  );
}

/**
 * Whether every pipeline of a command line (`$(…)` and `bash -c` included)
 * besides cds starts with one of `commands` ("doppler run"), so it may run
 * outside the sandbox without taking other commands along.
 */
export function runsOnly(pipelines: Pipeline[], commands: string[]): boolean {
  const rest = pipelines.filter((pipeline) => !isCd(pipeline));
  return (
    rest.length > 0 &&
    rest.every((pipeline) => commands.some((c) => startsWith(pipeline, c)))
  );
}

/**
 * The command to offer running outside the sandbox: the one program and
 * subcommand besides cd that starts every pipeline, whichever process (the
 * program, or a helper like doppler's `security`) hit the credential.
 */
export function commandToAllow(pipelines: Pipeline[]): string | null {
  const commands = new Set(
    pipelines.filter((pipeline) => !isCd(pipeline)).map(commandOf),
  );
  const [command] = commands;
  return commands.size === 1 && command ? command : null;
}
