/**
 * Anthropic API keys a conversation falls back to, in order, when the Claude
 * subscription runs out (~/.ignite/fallback-keys.json, owner-only). Keys never
 * leave the sidecar.
 */
import { randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { APP_NAME } from "../src/lib/app.ts";
import type { FallbackKeyInfo } from "../shared/fallbackKeys.ts";
import { apiKeyProblem } from "../shared/validation.ts";

/** A saved fallback key. */
export type FallbackKey = { id: string; key: string };

/** Where the keys are kept. */
export function fallbackFile(home = homedir()): string {
  return join(home, `.${APP_NAME}`, "fallback-keys.json");
}

/** The saved keys, in the order they're tried; none when the file is missing or unreadable. */
export async function loadKeys(file = fallbackFile()): Promise<FallbackKey[]> {
  try {
    const { keys } = JSON.parse(await readFile(file, "utf8"));
    return Array.isArray(keys) ? keys : [];
  } catch {
    return [];
  }
}

async function save(file: string, keys: FallbackKey[]) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify({ keys }, null, 2) + "\n", {
    mode: 0o600,
  });
  // writeFile's mode applies only when it creates the file.
  await chmod(file, 0o600);
}

/** What the app may see of them. */
export function describe(keys: FallbackKey[]): FallbackKeyInfo[] {
  return keys.map(({ id, key }) => ({ id, hint: key.slice(-4) }));
}

/** Adds a key last; throws when it can't be one. */
export async function addKey(apiKey: string, file = fallbackFile()) {
  const key = apiKey.trim();
  const problem = apiKeyProblem(key);
  if (problem) throw new Error(problem);
  const keys = await loadKeys(file);
  keys.push({ id: randomUUID(), key });
  await save(file, keys);
  return keys;
}

/** Removes key `id`. */
export async function removeKey(id: string, file = fallbackFile()) {
  const keys = (await loadKeys(file)).filter((k) => k.id !== id);
  await save(file, keys);
  return keys;
}

/** Moves key `id` one place earlier (-1) or later (1). */
export async function moveKey(id: string, by: -1 | 1, file = fallbackFile()) {
  const keys = await loadKeys(file);
  const from = keys.findIndex((k) => k.id === id);
  const to = from + by;
  if (from < 0 || to < 0 || to >= keys.length) return keys;
  [keys[from], keys[to]] = [keys[to]!, keys[from]!];
  await save(file, keys);
  return keys;
}

/** The host's fallback key requests. */
export const fallbackKeyHandlers = {
  fallback_keys: async () => describe(await loadKeys()),
  fallback_key_add: async (_ctx: unknown, r: { apiKey: string }) =>
    describe(await addKey(r.apiKey)),
  fallback_key_remove: async (_ctx: unknown, r: { key: string }) =>
    describe(await removeKey(r.key)),
  fallback_key_move: async (_ctx: unknown, r: { key: string; by: -1 | 1 }) =>
    describe(await moveKey(r.key, r.by)),
};
