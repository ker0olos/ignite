/** Consolidation's record of each group's last pass (the consolidations table), and its memory reads. */
import type { DatabaseSync } from "node:sqlite";
import { toMemory, type Memory } from "./memoryDb.ts";

/** The memories `sql` selects. */
export const memoriesOf = (
  db: DatabaseSync,
  sql: string,
  ...params: (string | number)[]
): Memory[] =>
  (db.prepare(sql).all(...params) as Record<string, unknown>[]).map(toMemory);

// By id, not time: cmem's memories are imported later with the time they were recorded.
/** The newest id `key`'s last pass in `folder` took; 0 before any. */
export const lastPass = (db: DatabaseSync, folder: string, key: string) =>
  (
    db
      .prepare(
        "SELECT last_id FROM consolidations WHERE folder = ? AND key = ?",
      )
      .get(folder, key) as { last_id: number } | undefined
  )?.last_id ?? 0;

/** Every key's last pass in `folder`. */
export const lastPasses = (db: DatabaseSync, folder: string) =>
  new Map(
    (
      db
        .prepare("SELECT key, last_id FROM consolidations WHERE folder = ?")
        .all(folder) as { key: string; last_id: number }[]
    ).map((r) => [r.key, r.last_id]),
  );

/** Records that `key`'s pass in `folder` took memories up to `id`. */
export const recordPass = (
  db: DatabaseSync,
  folder: string,
  key: string,
  id: number,
  now: number,
) =>
  db
    .prepare(
      `INSERT INTO consolidations (folder, key, last_id, at) VALUES (?, ?, ?, ?)
       ON CONFLICT (folder, key) DO UPDATE SET last_id = excluded.last_id, at = excluded.at`,
    )
    .run(folder, key, id, now);
