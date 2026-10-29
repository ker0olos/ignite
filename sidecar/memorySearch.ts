/** Reading the memory: a folder's latest, a full-text search, by id and around one. */
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { CONSOLIDATED, PROCEDURE, SUMMARY_TYPE } from "../shared/memory.ts";
import { toMemory, type Memory } from "./memoryDb.ts";

type Rows = Record<string, unknown>[];

// A memory with concept `?` is left out; "" leaves none out.
const lacks = (column: string) =>
  `NOT EXISTS (SELECT 1 FROM json_each(${column}) WHERE value = ?)`;

/** The SQL for a memory consolidation hasn't retired: retired ones stay for memory_get, out of every list. */
export const ACTIVE = "retired_at IS NULL";

/** The SQL for a memory with `concept`, one of the app's own (never user text). */
export const hasConcept = (concept: string, column = "concepts") =>
  `EXISTS (SELECT 1 FROM json_each(${column}) WHERE value = '${concept}')`;

/** `folder`'s newest memories, newest first; `summaries` picks summaries or observations; `without` leaves out a concept's, `raw` the long-term ones. */
export function recent(
  db: DatabaseSync,
  folder: string,
  limit: number,
  summaries = false,
  without = "",
  raw = false,
): Memory[] {
  const rows = db
    .prepare(
      `SELECT * FROM memories WHERE folder = ? AND (type = ?) = ? AND ${ACTIVE}
       AND ${lacks("concepts")} AND ${lacks("concepts")}
       ORDER BY created_at DESC, id DESC LIMIT ?`,
    )
    .all(
      folder,
      SUMMARY_TYPE,
      summaries ? 1 : 0,
      without,
      raw ? CONSOLIDATED : "",
      limit,
    ) as Rows;
  return rows.map(toMemory);
}

/** `folder`'s long-term memories, newest first, `without` a concept's. */
export function longTerm(
  db: DatabaseSync,
  folder: string,
  limit: number,
  without = "",
): Memory[] {
  const rows = db
    .prepare(
      `SELECT * FROM memories WHERE folder = ? AND ${ACTIVE}
       AND EXISTS (SELECT 1 FROM json_each(concepts) WHERE value = ?) AND ${lacks("concepts")}
       ORDER BY created_at DESC, id DESC LIMIT ?`,
    )
    .all(folder, CONSOLIDATED, without, limit) as Rows;
  return rows.map(toMemory);
}

/** How many observations (not summaries) `folder` has. */
export function count(db: DatabaseSync, folder: string): number {
  const row = db
    .prepare(
      `SELECT count(*) AS n FROM memories WHERE folder = ? AND type <> ? AND ${ACTIVE}`,
    )
    .get(folder, SUMMARY_TYPE) as { n: number };
  return row.n;
}

// Each word quoted (FTS5 syntax in a query is just text) and matched as a prefix.
const terms = (query: string) =>
  query
    .split(/\s+/)
    .filter((t) => /[\p{L}\p{N}]/u.test(t))
    .map((t) => `"${t.replaceAll('"', '""')}"*`);

export type SearchFilter = {
  /** Only these types. */
  types?: string[];
  /** Only memories from then on, in ms since the epoch. */
  since?: number;
  /** Leaves out memories with this concept. */
  without?: string;
  limit: number;
};

function matching(
  db: DatabaseSync,
  folder: string,
  match: string,
  { types = [], since, without = "", limit }: SearchFilter,
): Memory[] {
  const where = [
    "memories_fts MATCH ?",
    "m.folder = ?",
    "m.retired_at IS NULL",
    lacks("m.concepts"),
    ...(types.length ? [`m.type IN (${types.map(() => "?").join(", ")})`] : []),
    ...(since === undefined ? [] : ["m.created_at >= ?"]),
  ];
  const params: SQLInputValue[] = [match, folder, without, ...types];
  if (since !== undefined) params.push(since);
  const rows = db
    .prepare(
      `SELECT m.* FROM memories_fts JOIN memories m ON m.id = memories_fts.rowid
       WHERE ${where.join(" AND ")} ORDER BY bm25(memories_fts) LIMIT ?`,
    )
    .all(...params, limit) as Rows;
  return rows.map(toMemory);
}

/** `folder`'s memories matching every word of `query`, best first; any word when none matches them all. */
export function search(
  db: DatabaseSync,
  folder: string,
  query: string,
  filter: SearchFilter,
): Memory[] {
  const words = terms(query);
  if (!words.length) return [];
  const all = matching(db, folder, words.join(" "), filter);
  if (all.length || words.length === 1) return all;
  return matching(db, folder, words.join(" OR "), filter);
}

/** `folder`'s memories with these ids, in the order asked; another folder's are left out. */
export function byIds(
  db: DatabaseSync,
  folder: string,
  ids: number[],
): Memory[] {
  if (!ids.length) return [];
  const rows = db
    .prepare(
      `SELECT * FROM memories WHERE folder = ? AND id IN (${ids.map(() => "?").join(", ")})`,
    )
    .all(folder, ...ids) as Rows;
  const found = new Map(rows.map((r) => [Number(r.id), toMemory(r)]));
  return ids.flatMap((id) => found.get(id) ?? []);
}

/** `folder`'s memory `id` with the `before` memories just before it and `after` just after, oldest first. */
export function around(
  db: DatabaseSync,
  folder: string,
  id: number,
  before: number,
  after: number,
): Memory[] {
  const [anchor] = byIds(db, folder, [id]);
  if (!anchor) return [];
  const side = (op: string, order: string, n: number) =>
    (
      db
        .prepare(
          `SELECT * FROM memories WHERE folder = ? AND ${ACTIVE} AND (created_at, id) ${op} (?, ?)
           ORDER BY created_at ${order}, id ${order} LIMIT ?`,
        )
        .all(anchor.folder, anchor.createdAt, anchor.id, n) as Rows
    ).map(toMemory);
  return [
    ...side("<", "DESC", before).reverse(),
    anchor,
    ...side(">", "ASC", after),
  ];
}

/** The titles conversation `conversation` already recorded, newest `limit`, oldest first. */
export function recordedBy(
  db: DatabaseSync,
  conversation: string,
  limit = 100,
): string[] {
  const rows = db
    .prepare(
      "SELECT title FROM memories WHERE conversation = ? ORDER BY id DESC LIMIT ?",
    )
    .all(conversation, limit) as { title: string }[];
  return rows.map((r) => r.title).reverse();
}

/** How many observations of each type `folder` keeps. */
export function counts(db: DatabaseSync, folder: string) {
  const rows = db
    .prepare(
      `SELECT type, count(*) AS n FROM memories WHERE folder = ? AND type <> ? AND ${ACTIVE} GROUP BY type`,
    )
    .all(folder, SUMMARY_TYPE) as { type: string; n: number }[];
  return Object.fromEntries(rows.map((r) => [r.type, r.n]));
}

/** `folder`'s (every folder's, for null) newest memories with concept `concept`, newest first. */
export function withConcept(
  db: DatabaseSync,
  folder: string | null,
  concept: string,
  limit: number,
): Memory[] {
  const rows = db
    .prepare(
      `SELECT * FROM memories WHERE (? IS NULL OR folder = ?) AND ${ACTIVE}
       AND EXISTS (SELECT 1 FROM json_each(concepts) WHERE value = ?)
       ORDER BY created_at DESC, id DESC LIMIT ?`,
    )
    .all(folder, folder, concept, limit) as Rows;
  return rows.map(toMemory);
}

/** Whether memory `id` is a procedure (sidecar/procedures.ts). */
export function isProcedure(db: DatabaseSync, id: number): boolean {
  return !!db
    .prepare(
      `SELECT 1 FROM memories WHERE id = ?
       AND EXISTS (SELECT 1 FROM json_each(concepts) WHERE value = ?)`,
    )
    .get(id, PROCEDURE);
}

/** `folder`'s newest observations of type `kind`, newest first. */
export function latestOf(
  db: DatabaseSync,
  folder: string,
  kind: string,
  limit: number,
): Memory[] {
  const rows = db
    .prepare(
      `SELECT * FROM memories WHERE folder = ? AND type = ? AND ${ACTIVE}
       ORDER BY created_at DESC, id DESC LIMIT ?`,
    )
    .all(folder, kind, limit) as Rows;
  return rows.map(toMemory);
}
