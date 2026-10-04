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

/** The programs a command line runs by name from PATH; `./x`, `/bin/x` and `PATH=. x` don't count. */
export function programsOf(pipelines: Pipeline[]): string[] {
  return pipelines
    .flat()
    .flatMap(({ words: [program] }) =>
      program && !/[/=]/.test(program) ? [program] : [],
    );
}

/**
 * Whether a command line runs one of `programs` and every pipeline in it
 * (`$(…)` and `bash -c` included) starts with one of them or a cd, so it
 * may run outside the sandbox without taking other commands along.
 */
export function runsOnly(pipelines: Pipeline[], programs: string[]): boolean {
  const heads = pipelines.map(([first]) => programsOf([[first]])[0]);
  return (
    heads.some((head) => programs.includes(head)) &&
    heads.every((head) => head === "cd" || programs.includes(head))
  );
}
