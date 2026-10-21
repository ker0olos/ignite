/**
 * Imports cmem's (claude-mem's) memories, read from its database without
 * its worker. Each is imported once; a later import takes what's new since,
 * and what couldn't be placed in a folder before.
 */
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SUMMARY_TYPE } from "../shared/memory.ts";
import {
  addMemories,
  list,
  summaryOf,
  trimmed,
  typeOf,
  type NewMemory,
} from "./memoryDb.ts";
import { writerInput } from "./memoryWriter.ts";
import { routerInput } from "./router.ts";
import { worktreeOf } from "./worktreeGit.ts";

export const CMEM_DB = join(
  process.env.CLAUDE_MEM_DATA_DIR ?? join(homedir(), ".claude-mem"),
  "claude-mem.db",
);

type Row = Record<string, unknown>;
type Session = { folder: string; platform: string; conversation: string };

// cmem names a project by its folder, and an agent's worktree by `<project>/<id>`.
const projectOf = (key: unknown) => String(key).split("/")[0];
const isWorktree = (cwd: string) =>
  worktreeOf(cwd) !== null || /[\\/]\.claude[\\/]worktrees[\\/]/.test(cwd);
// The first line of each of the app's own model calls (the memory's writer, the router, and the old reflector's).
const HELPER_STARTS = [
  ...[writerInput("", []), routerInput("", [])].map(
    (input) => input.split("\n")[0],
  ),
  "Existing lessons:",
];

// claude-mem's hook in claude-bridge's Claude Code records the app's own
// conversations (in their worktrees) and its model calls; the app already remembers those itself.
const ownConversation = (r: Row) =>
  (typeof r.cwd === "string" && worktreeOf(r.cwd) !== null) ||
  (typeof r.user_prompt === "string" &&
    HELPER_STARTS.some((start) => (r.user_prompt as string).startsWith(start)));
const folderOf = (r: Row) =>
  typeof r.cwd === "string" && r.cwd && !isWorktree(r.cwd) ? r.cwd : null;

// The folder each project was most often worked in, for its sessions that don't say.
function usualFolders(rows: Row[]): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const folder = folderOf(r);
    if (!folder) continue;
    const project = counts.get(projectOf(r.project)) ?? new Map();
    project.set(folder, (project.get(folder) ?? 0) + 1);
    counts.set(projectOf(r.project), project);
  }
  return new Map(
    [...counts].map(([p, c]) => [
      p,
      [...c].reduce((a, b) => (b[1] > a[1] ? b : a))[0],
    ]),
  );
}

/** cmem's sessions by memory session id, each in the folder it was worked in, else its project's usual one; those with neither, and the app's own conversations, are left out. */
export function sessionsOf(rows: Row[]): Map<string, Session> {
  const usual = usualFolders(rows);
  const sessions = new Map<string, Session>();
  for (const r of rows) {
    if (ownConversation(r)) continue;
    const folder = folderOf(r) ?? usual.get(projectOf(r.project));
    if (!folder || typeof r.memory_session_id !== "string") continue;
    sessions.set(r.memory_session_id, {
      folder,
      platform: String(r.platform_source),
      conversation: String(r.content_session_id),
    });
  }
  return sessions;
}

/** A cmem observation as a memory. */
export function fromObservation(r: Row, s: Session): NewMemory | null {
  const title = trimmed(r.title);
  if (!title) return null;
  return {
    ...s,
    type: typeOf(r.type),
    title,
    subtitle: trimmed(r.subtitle),
    facts: list(r.facts),
    narrative: trimmed(r.narrative),
    concepts: list(r.concepts),
    filesRead: list(r.files_read),
    filesModified: list(r.files_modified),
    createdAt: Number(r.created_at_epoch),
    origin: `cmem:o:${r.id}`,
  };
}

/** A cmem session summary as a memory. */
export function fromSummary(r: Row, s: Session): NewMemory | null {
  const summary = summaryOf(r);
  if (!summary) return null;
  return {
    ...s,
    ...summary,
    type: SUMMARY_TYPE,
    subtitle: null,
    facts: [],
    concepts: [],
    filesRead: list(r.files_read),
    filesModified: list(r.files_edited),
    createdAt: Number(r.created_at_epoch),
    origin: `cmem:s:${r.id}`,
  };
}

const KINDS = {
  o: { table: "observations", named: "title", from: fromObservation },
  s: { table: "session_summaries", named: "request", from: fromSummary },
} as const;
type Kind = keyof typeof KINDS;

const BATCH = 500;

// Older cmem databases lack some columns; theirs read as null.
function optional(cmem: DatabaseSync, columns: string[]) {
  const has = new Set(
    (
      cmem
        .prepare("SELECT name FROM pragma_table_info('sdk_sessions')")
        .all() as {
        name: string;
      }[]
    ).map((c) => c.name),
  );
  return columns.map((c) => (has.has(c) ? c : `NULL AS ${c}`)).join(", ");
}

function sessions(cmem: DatabaseSync) {
  const extra = optional(cmem, ["cwd", "user_prompt"]);
  return sessionsOf(
    cmem
      .prepare(
        `SELECT memory_session_id, content_session_id, project, platform_source, ${extra} FROM sdk_sessions`,
      )
      .all() as Row[],
  );
}

function imported(db: DatabaseSync, kind: Kind): Set<number> {
  const rows = db
    .prepare("SELECT substr(origin, 8) AS id FROM memories WHERE origin LIKE ?")
    .all(`cmem:${kind}:%`) as { id: string }[];
  return new Set(rows.map((r) => Number(r.id)));
}

/** The ids of cmem's memories of `kind` an import would add: named, in a placed session, not imported yet. */
function waiting(
  db: DatabaseSync,
  cmem: DatabaseSync,
  kind: Kind,
  placed: Map<string, Session>,
): number[] {
  const { table, named } = KINDS[kind];
  const done = imported(db, kind);
  const rows = cmem
    .prepare(
      `SELECT id, memory_session_id AS session FROM ${table} WHERE trim(coalesce(${named}, '')) <> ''`,
    )
    .all() as { id: number; session: string }[];
  return rows
    .filter((r) => !done.has(r.id) && placed.has(r.session))
    .map((r) => r.id);
}

function memoriesOf(
  cmem: DatabaseSync,
  kind: Kind,
  ids: number[],
  placed: Map<string, Session>,
): NewMemory[] {
  const { table, from } = KINDS[kind];
  const found: NewMemory[] = [];
  for (let i = 0; i < ids.length; i += BATCH) {
    const part = ids.slice(i, i + BATCH);
    const rows = cmem
      .prepare(
        `SELECT * FROM ${table} WHERE id IN (${part.map(() => "?").join(", ")})`,
      )
      .all(...part) as Row[];
    for (const r of rows) {
      const memory = from(r, placed.get(String(r.memory_session_id))!);
      if (memory) found.push(memory);
    }
  }
  return found;
}

function withCmem<T>(file: string, read: (cmem: DatabaseSync) => T) {
  if (!existsSync(file)) return undefined;
  const cmem = new DatabaseSync(file, { readOnly: true });
  try {
    return read(cmem);
  } finally {
    cmem.close();
  }
}

/** Imports cmem's memories not imported yet; returns how many were added. */
export function importCmem(db: DatabaseSync, file = CMEM_DB): number {
  const added = withCmem(file, (cmem) => {
    const placed = sessions(cmem);
    const memories = (["o", "s"] as const).flatMap((kind) =>
      memoriesOf(cmem, kind, waiting(db, cmem, kind, placed), placed),
    );
    return addMemories(db, memories);
  });
  // One big import would otherwise leave a log as large as the database beside it.
  if (added) db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  return added ?? 0;
}
