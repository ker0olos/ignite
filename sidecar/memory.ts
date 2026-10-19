/** The memory's on/off setting, what the Memory settings show and search, and importing cmem's at start. */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { parse as parseToml } from "smol-toml";
import { OBSERVATION_TYPES, type MemoryStatus } from "../shared/memory.ts";
import { APP_NAME } from "../src/lib/app.ts";
import { memoryDb } from "./memoryDb.ts";
import { CMEM_DB, importCmem } from "./memoryImport.ts";
import { counts, latestOf, recent, search } from "./memorySearch.ts";

/** Whether the app's settings leave memory on (`[memory] enabled`, once `cmem`). */
export async function memoryEnabled(
  settingsFile = join(homedir(), `.${APP_NAME}`, "settings.toml"),
): Promise<boolean> {
  try {
    const settings = parseToml(await readFile(settingsFile, "utf8"));
    const memory = settings.memory as Record<string, unknown> | undefined;
    return (memory?.enabled ?? memory?.cmem) !== false;
  } catch {
    return true;
  }
}

const SHOWN = 12;

const unique = (paths: string[]) => [...new Set(paths)];

/** What a search of the Memory settings asks for: words, and one type. */
export type MemoryFilter = { query?: string; kind?: string };

function shown(
  db: DatabaseSync,
  folder: string,
  { query, kind }: MemoryFilter,
) {
  if (query?.trim()) {
    const types = kind ? [kind] : [...OBSERVATION_TYPES];
    return search(db, folder, query, { types, limit: SHOWN });
  }
  return kind ? latestOf(db, folder, kind, SHOWN) : recent(db, folder, SHOWN);
}

/** What the Memory settings show: the folder's counts by type, and its latest memories or a search's best matches. */
export function memoryStatus(
  folder?: string,
  filter: MemoryFilter = {},
  db = memoryDb(),
): MemoryStatus {
  if (!folder) return { counts: {}, observations: [] };
  const observations = shown(db, folder, filter).map((m) => ({
    id: m.id,
    type: m.type,
    title: m.title,
    ...(m.subtitle && { subtitle: m.subtitle }),
    createdAt: m.createdAt,
    platform: m.platform,
    facts: m.facts,
    files: unique([...m.filesModified, ...m.filesRead]),
  }));
  return { counts: counts(db, folder), observations };
}

// ponytail: the import runs on the sidecar's thread (about 2s for 25k memories, once); a worker if it grows.
/** Imports cmem's new memories while memory is on, quietly: cmem is only a compatibility layer, and a failed import leaves the memory as it was. */
export async function importOnStart(db?: DatabaseSync, cmem = CMEM_DB) {
  if (!(await memoryEnabled())) return;
  try {
    importCmem(db ?? memoryDb(), cmem);
  } catch {
    // An unreadable cmem database (another version's schema) just imports nothing.
  }
}
