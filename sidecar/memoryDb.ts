/**
 * The agent's memory (~/.ignite/memory.db): observations of past work and
 * runs' summaries, per folder, with a full-text index.
 */
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { OBSERVATION_TYPES } from "../shared/memory.ts";
import { APP_NAME } from "../src/lib/app.ts";

export const MEMORY_DB = join(homedir(), `.${APP_NAME}`, "memory.db");

/** A memory: an observation of the work, or a run's summary (SUMMARY_TYPE). */
export type Memory = {
  id: number;
  folder: string;
  /** pi's session id of the conversation it came from. */
  conversation: string | null;
  /** The agent that did the work: this app, "claude" (Claude Code), "codex"… */
  platform: string;
  type: string;
  title: string;
  subtitle: string | null;
  facts: string[];
  narrative: string | null;
  concepts: string[];
  filesRead: string[];
  filesModified: string[];
  createdAt: number;
  /** When consolidation retired it (memoryConsolidate.ts): merged into `supersededBy`, or stale. */
  retiredAt?: number;
  supersededBy?: number;
  retiredReason?: string;
};

/** A memory to add; `origin` names an imported one, so it's imported once. */
export type NewMemory = Omit<Memory, "id"> & { origin?: string };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS memories (
  id INTEGER PRIMARY KEY,
  folder TEXT NOT NULL,
  conversation TEXT,
  platform TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  facts TEXT NOT NULL,
  narrative TEXT,
  concepts TEXT NOT NULL,
  files_read TEXT NOT NULL,
  files_modified TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  origin TEXT UNIQUE
);
CREATE INDEX IF NOT EXISTS memories_folder ON memories(folder, created_at);
CREATE INDEX IF NOT EXISTS memories_conversation ON memories(conversation, id);
CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
  title, subtitle, narrative, facts, concepts,
  content='memories', content_rowid='id', tokenize='porter unicode61'
);
CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
  INSERT INTO memories_fts(rowid, title, subtitle, narrative, facts, concepts)
  VALUES (new.id, new.title, new.subtitle, new.narrative, new.facts, new.concepts);
END;
CREATE TABLE IF NOT EXISTS consolidations (
  folder TEXT NOT NULL,
  key TEXT NOT NULL,
  last_id INTEGER NOT NULL,
  at INTEGER NOT NULL,
  PRIMARY KEY (folder, key)
);`;

// Added after the table shipped; a database from before gets them on open.
const RETIRED_COLUMNS = {
  retired_at: "INTEGER",
  superseded_by: "INTEGER",
  retired_reason: "TEXT",
};

function addColumns(db: DatabaseSync) {
  const columns = db.prepare("PRAGMA table_info(memories)").all() as {
    name: string;
  }[];
  const have = new Set(columns.map((c) => c.name));
  for (const [name, type] of Object.entries(RETIRED_COLUMNS)) {
    if (have.has(name)) continue;
    try {
      db.exec(`ALTER TABLE memories ADD COLUMN ${name} ${type}`);
    } catch (error) {
      // Another sidecar opening the same database added it first.
      if (!/duplicate column/i.test(String(error))) throw error;
    }
  }
}

// On globalThis: pi loads extensions afresh per session and on every reload,
// and each copy of this module would otherwise open (and leak) its own connection.
const KEY = Symbol.for("ignite.memoryDb");
const shared = globalThis as { [KEY]?: Map<string, DatabaseSync> };
const open = (shared[KEY] ??= new Map<string, DatabaseSync>());

/** The memory database at `file`, made on first use; one connection per file. */
export function memoryDb(file = MEMORY_DB): DatabaseSync {
  let db = open.get(file);
  if (db) return db;
  mkdirSync(dirname(file), { recursive: true });
  db = new DatabaseSync(file);
  // Sessions read while the host writes.
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  addColumns(db);
  open.set(file, db);
  return db;
}

type Row = Record<string, unknown>;

/** A JSON list of strings as stored; empty when it isn't one. */
export const list = (v: unknown): string[] => {
  try {
    const parsed: unknown = JSON.parse(String(v ?? "[]"));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

const textOrNull = (v: unknown) => (typeof v === "string" ? v : null);

/** A `memories` row as a Memory. */
export const toMemory = (r: Row): Memory => ({
  id: Number(r.id),
  folder: String(r.folder),
  conversation: textOrNull(r.conversation),
  platform: String(r.platform),
  type: String(r.type),
  title: String(r.title),
  subtitle: textOrNull(r.subtitle),
  facts: list(r.facts),
  narrative: textOrNull(r.narrative),
  concepts: list(r.concepts),
  filesRead: list(r.files_read),
  filesModified: list(r.files_modified),
  createdAt: Number(r.created_at),
  ...(r.retired_at != null && {
    retiredAt: Number(r.retired_at),
    ...(r.superseded_by != null && { supersededBy: Number(r.superseded_by) }),
    ...(typeof r.retired_reason === "string" && {
      retiredReason: r.retired_reason,
    }),
  }),
});

const SECTIONS = [
  ["investigated", "Investigated"],
  ["learned", "Learned"],
  ["completed", "Completed"],
  ["next_steps", "Next steps"],
  ["notes", "Notes"],
] as const;

/** Text without its surrounding space; null when there's none. */
export const trimmed = (v: unknown) =>
  typeof v === "string" && v.trim() ? v.trim() : null;

const TYPES = new Set<string>(OBSERVATION_TYPES);

// The model sometimes writes a type of its own; its observation still holds.
/** An observation's type, or "change" for one that isn't an OBSERVATION_TYPES. */
export const typeOf = (v: unknown) =>
  TYPES.has(String(v)) ? String(v) : "change";

/** A run's summary (`request`, `investigated`, `learned`… as cmem keeps them) as a memory's title and narrative; null without a request. */
export function summaryOf(fields: Record<string, unknown>) {
  const title = trimmed(fields.request);
  if (!title) return null;
  const narrative = SECTIONS.flatMap(([key, label]) => {
    const body = trimmed(fields[key]);
    return body ? [`${label}: ${body}`] : [];
  }).join("\n\n");
  return { title, narrative: narrative || null };
}

/** Removes memory `id`, from the full-text index too (it has no delete trigger). */
export function removeMemory(db: DatabaseSync, id: number) {
  db.exec("BEGIN");
  try {
    // An external-content index forgets a row only when given its indexed values.
    db.prepare(
      `INSERT INTO memories_fts(memories_fts, rowid, title, subtitle, narrative, facts, concepts)
       SELECT 'delete', id, title, subtitle, narrative, facts, concepts FROM memories WHERE id = ?`,
    ).run(id);
    db.prepare("DELETE FROM memories WHERE id = ?").run(id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

const INSERT = `INSERT INTO memories
  (folder, conversation, platform, type, title, subtitle, facts, narrative,
   concepts, files_read, files_modified, created_at, origin)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(origin) DO NOTHING`;

/** Adds memory `m` outside any transaction of its own; its id, or null for one already imported. */
export function addMemory(db: DatabaseSync, m: NewMemory): number | null {
  const { changes, lastInsertRowid } = db
    .prepare(INSERT)
    .run(
      m.folder,
      m.conversation,
      m.platform,
      m.type,
      m.title,
      m.subtitle,
      JSON.stringify(m.facts),
      m.narrative,
      JSON.stringify(m.concepts),
      JSON.stringify(m.filesRead),
      JSON.stringify(m.filesModified),
      m.createdAt,
      m.origin ?? null,
    );
  return changes ? Number(lastInsertRowid) : null;
}

/** Adds `memories` in one transaction, skipping already imported ones; returns how many were added. */
export function addMemories(db: DatabaseSync, memories: NewMemory[]): number {
  let added = 0;
  db.exec("BEGIN");
  try {
    for (const m of memories) if (addMemory(db, m) !== null) added++;
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return added;
}
