/** Which of a folder's memories consolidation takes next (a file's, or the procedures'), and writing what came of them. */
import { basename, isAbsolute, posix } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { CONSOLIDATED, PROCEDURE, SUMMARY_TYPE } from "../shared/memory.ts";
import { APP_NAME } from "../src/lib/app.ts";
import {
  addMemory,
  list,
  toMemory,
  type Memory,
  type NewMemory,
} from "./memoryDb.ts";
import { ACTIVE } from "./memorySearch.ts";
import { worktreeBase } from "./worktreeGit.ts";

/** A group's key for the folder's procedures; any other key is a file's path. */
export const PROCEDURES_KEY = "#procedures";

/** Memories consolidated together: `raw` added since the key's last pass, oldest first, and its newest long-term ones; `newest` is its newest pending id, taken or not. */
export type Group = {
  key: string;
  raw: Memory[];
  longTerm: Memory[];
  newest: number;
};

const PENDING = { file: 8, procedures: 6 };
const MAX_RAW = 40;
const MAX_LONG_TERM = 3;
// ponytail: candidates come from the last 30 days' file lists, read on each settle; an index if folders grow far past 20k.
const WINDOW_MS = 30 * 864e5;

const WORKTREE = new RegExp(
  `[\\\\/]\\.${APP_NAME}[\\\\/]worktrees[\\\\/]([^\\\\/]+)[\\\\/][^\\\\/]+[\\\\/](.+)$`,
);

// Keys use "/" on every platform, so a Windows path and the same one written with "/" are one file.
const inside = (key: string) => {
  const clean = posix.normalize(key.replaceAll("\\", "/"));
  const out = /^(?:\/|[A-Za-z]:|\.\.(?:\/|$))/.test(clean);
  return out ? null : clean;
};

/** `path` from `folder`'s root (a worktree of it too: Claude Code's memories name absolute paths); null outside it. */
export function fileKey(folder: string, path: string): string | null {
  for (const sep of ["/", "\\"])
    if (path.startsWith(folder + sep))
      return inside(path.slice(folder.length + 1));
  const inWorktree = WORKTREE.exec(path);
  // Only this folder's worktrees: another folder's file isn't this one's.
  if (inWorktree?.[1] === basename(worktreeBase(folder)))
    return inside(inWorktree[2]);
  return isAbsolute(path) ? null : inside(path);
}

const has = (concept: string) =>
  `EXISTS (SELECT 1 FROM json_each(concepts) WHERE value = '${concept}')`;
const RAW = `${ACTIVE} AND type <> '${SUMMARY_TYPE}' AND NOT ${has(CONSOLIDATED)}`;

const rows = (db: DatabaseSync, sql: string, ...params: (string | number)[]) =>
  (db.prepare(sql).all(...params) as Record<string, unknown>[]).map(toMemory);

// By id, not time: cmem's memories are imported later with the time they were recorded.
const lastId = (db: DatabaseSync, folder: string, key: string) =>
  (
    db
      .prepare(
        "SELECT last_id FROM consolidations WHERE folder = ? AND key = ?",
      )
      .get(folder, key) as { last_id: number } | undefined
  )?.last_id ?? 0;

const lastIds = (db: DatabaseSync, folder: string) =>
  new Map(
    (
      db
        .prepare("SELECT key, last_id FROM consolidations WHERE folder = ?")
        .all(folder) as { key: string; last_id: number }[]
    ).map((r) => [r.key, r.last_id]),
  );

const keysOf = (folder: string, files: string[]) =>
  new Set(files.flatMap((p) => fileKey(folder, p) ?? []));

/** `folder`'s files with PENDING.file or more raw memories since their last pass, most first. */
function pendingFiles(db: DatabaseSync, folder: string, now: number) {
  const recent = db
    .prepare(
      `SELECT id, files_modified FROM memories WHERE folder = ? AND ${RAW} AND NOT ${has(PROCEDURE)} AND created_at >= ?`,
    )
    .all(folder, now - WINDOW_MS) as { id: number; files_modified: string }[];
  const since = lastIds(db, folder);
  const counts = new Map<string, number>();
  for (const m of recent)
    for (const key of keysOf(folder, list(m.files_modified)))
      if (m.id > (since.get(key) ?? 0))
        counts.set(key, (counts.get(key) ?? 0) + 1);
  return [...counts]
    .filter(([, n]) => n >= PENDING.file)
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key);
}

// Text as files_modified's JSON writes it, for LIKE.
const likeOf = (text: string) =>
  JSON.stringify(text)
    .slice(1, -1)
    .replace(/[\\%_]/g, (c) => `\\${c}`);

// LIKE only narrows the rows; keysOf decides, as it does for the counts. Either separator, whole or after a folder.
const naming = (key: string) => {
  const forms = [...new Set([key, key.replaceAll("/", "\\")])];
  const params = forms.flatMap((k) => [
    `%"${likeOf(k)}"%`,
    `%${likeOf(`/${k}`)}"%`,
    `%${likeOf(`\\${k}`)}"%`,
  ]);
  const sql = params.map(() => "files_modified LIKE ? ESCAPE '\\'");
  return { sql: `(${sql.join(" OR ")})`, params };
};

function fileGroup(db: DatabaseSync, folder: string, key: string): Group {
  const { sql, params } = naming(key);
  const names = (m: Memory) => keysOf(folder, m.filesModified).has(key);
  const raw = rows(
    db,
    `SELECT * FROM memories WHERE folder = ? AND ${RAW} AND NOT ${has(PROCEDURE)} AND ${sql}
     AND id > ? ORDER BY id`,
    folder,
    ...params,
    lastId(db, folder, key),
  ).filter(names);
  const longTerm = rows(
    db,
    `SELECT * FROM memories WHERE folder = ? AND ${ACTIVE} AND ${has(CONSOLIDATED)}
     AND NOT ${has(PROCEDURE)} AND ${sql} ORDER BY created_at DESC, id DESC`,
    folder,
    ...params,
  ).filter(names);
  return {
    key,
    raw: raw.slice(0, MAX_RAW),
    longTerm: longTerm.slice(0, MAX_LONG_TERM),
    newest: raw.at(-1)?.id ?? 0,
  };
}

function procedureGroup(db: DatabaseSync, folder: string): Group | null {
  const raw = rows(
    db,
    `SELECT * FROM memories WHERE folder = ? AND ${RAW} AND ${has(PROCEDURE)}
     AND id > ? ORDER BY id`,
    folder,
    lastId(db, folder, PROCEDURES_KEY),
  );
  if (raw.length < PENDING.procedures) return null;
  const longTerm = rows(
    db,
    `SELECT * FROM memories WHERE folder = ? AND ${ACTIVE} AND ${has(CONSOLIDATED)}
     AND ${has(PROCEDURE)} ORDER BY created_at DESC, id DESC LIMIT 10`,
    folder,
  );
  return {
    key: PROCEDURES_KEY,
    raw: raw.slice(0, MAX_RAW),
    longTerm,
    newest: raw.at(-1)!.id,
  };
}

/** Where a tried group is kept: by folder and key, with the newest pending id it was tried at. */
export const triedKey = (folder: string, g: Group) => `${folder}\0${g.key}`;

/** Groups whose pass came to nothing, each kept until it grows past the newest id it had. */
export type Tried = Map<string, number>;

const wasTried = (skip: Tried, folder: string, g: Group) =>
  skip.get(triedKey(folder, g)) === g.newest;

/** `folder`'s groups ready to consolidate: the procedures first (unless `procedures` is off), then files with the most pending; `skip` leaves out ones tried already that haven't grown. */
export function* groups(
  db: DatabaseSync,
  folder: string,
  options: { skip?: Tried; procedures?: boolean; now?: number } = {},
): Generator<Group> {
  const skip = options.skip ?? new Map<string, number>();
  const procedures =
    options.procedures === false ? null : procedureGroup(db, folder);
  if (procedures && !wasTried(skip, folder, procedures)) yield procedures;
  for (const key of pendingFiles(db, folder, options.now ?? Date.now())) {
    const g = fileGroup(db, folder, key);
    if (g.raw.length && !wasTried(skip, folder, g)) yield g;
  }
}

/** A long-term memory to write, with the group members it replaces. */
export type Entry = NewMemory & { sources: number[] };

/** What a pass made of a group: long-term entries, and members now wholly false. */
export type Outcome = {
  entries: Entry[];
  stale: { id: number; reason: string }[];
};

const RETIRE = `UPDATE memories SET retired_at = ?, superseded_by = ?, retired_reason = ?
  WHERE id = ? AND retired_at IS NULL`;

// Read before writing, so two entries citing one memory both stand. A source removed meanwhile (a
// procedure removed in Settings) or merged by another sidecar's pass of another file drops its entry.
const activeOf = (db: DatabaseSync, ids: number[]) =>
  new Set(
    ids.filter((id) =>
      db.prepare(`SELECT 1 FROM memories WHERE id = ? AND ${ACTIVE}`).get(id),
    ),
  );

function write(db: DatabaseSync, outcome: Outcome, now: number) {
  const retire = db.prepare(RETIRE);
  const active = activeOf(
    db,
    outcome.entries.flatMap((e) => e.sources),
  );
  for (const { sources, ...entry } of outcome.entries) {
    if (!sources.every((id) => active.has(id))) continue;
    const id = addMemory(db, entry);
    for (const source of sources)
      retire.run(now, id, `merged into memory ${id}`, source);
  }
  for (const { id, reason } of outcome.stale) retire.run(now, null, reason, id);
}

/** Writes `outcome` for `group` in one transaction: its entries added, their sources and the stale retired, the key's pass recorded; false, writing nothing, when another pass (another sidecar's) already took the group. */
export function applyOutcome(
  db: DatabaseSync,
  folder: string,
  group: Group,
  outcome: Outcome,
  now = Date.now(),
): boolean {
  // Raw ones only: a long-term member may come from another file's later pass.
  const last = Math.max(...group.raw.map((m) => m.id));
  db.exec("BEGIN IMMEDIATE");
  try {
    const taken = lastId(db, folder, group.key) >= last;
    if (!taken) {
      write(db, outcome, now);
      db.prepare(
        `INSERT INTO consolidations (folder, key, last_id, at) VALUES (?, ?, ?, ?)
         ON CONFLICT (folder, key) DO UPDATE SET last_id = excluded.last_id, at = excluded.at`,
      ).run(folder, group.key, last, now);
    }
    db.exec("COMMIT");
    return !taken;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
