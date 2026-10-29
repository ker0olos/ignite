/** Consolidation's groups of memories that changed no file: a new one, and the older ones its title shares most words with. */
import type { DatabaseSync } from "node:sqlite";
import { CONSOLIDATED, PROCEDURE, SUMMARY_TYPE } from "../shared/memory.ts";
import type { Memory } from "./memoryDb.ts";
import type { Group } from "./memoryGroups.ts";
import { lastPass, memoriesOf, recordPass } from "./memoryPasses.ts";
import { ACTIVE, hasConcept } from "./memorySearch.ts";

/** Every topic group's key: its pass records its seed, past which the next seeds are looked for. */
export const TOPICS_KEY = "#topics";

const MIN = 3;
const MAX = 12;
const LONG_TERM = 3;
// ponytail: a backlog is worked through this many seeds a settle; fine at thousands, a scheduled pass if one grows past that.
const SEEDS = 100;
const STOP = new Set(
  "with from that this into when then than have uses used only also does were what which they them their there after before".split(
    " ",
  ),
);

// `m` is the table's alias with its dot, or "".
const noFile = (m: string) =>
  `${m}${ACTIVE} AND ${m}files_modified = '[]' AND NOT ${hasConcept(PROCEDURE, `${m}concepts`)}`;
const rawOf = (m: string) =>
  `${noFile(m)} AND ${m}type <> '${SUMMARY_TYPE}' AND NOT ${hasConcept(CONSOLIDATED, `${m}concepts`)}`;
const longTermOf = (m: string) =>
  `${noFile(m)} AND ${hasConcept(CONSOLIDATED, `${m}concepts`)}`;

// A title's words as matched here: 4 letters or more, cut to their first 5 so "checked" meets "checkout".
const wordsOf = (title: string) =>
  new Set(
    (title.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? [])
      .filter((w) => !STOP.has(w))
      .map((w) => w.slice(0, 5)),
  );

/** Whether two titles share at least half the words of the shorter. */
export function sameTopic(a: string, b: string): boolean {
  const [x, y] = [wordsOf(a), wordsOf(b)];
  const shared = [...x].filter((w) => y.has(w)).length;
  return shared >= 2 && shared * 2 >= Math.min(x.size, y.size);
}

// Memories whose title shares a word with `seed`'s, best first; `sameTopic` decides.
function near(db: DatabaseSync, folder: string, seed: Memory, where: string) {
  const words = [...wordsOf(seed.title)].map((w) => `"${w}"*`);
  if (!words.length) return [];
  return memoriesOf(
    db,
    `SELECT m.* FROM memories_fts JOIN memories m ON m.id = memories_fts.rowid
     WHERE memories_fts MATCH ? AND m.folder = ? AND ${where}
     ORDER BY bm25(memories_fts) LIMIT 100`,
    `title : (${words.join(" OR ")})`,
    folder,
  ).filter((m) => m.id !== seed.id && sameTopic(seed.title, m.title));
}

// `seed` with the older raw memories on its topic, or null when too few are.
function topicGroup(
  db: DatabaseSync,
  folder: string,
  seed: Memory,
): Group | null {
  const older = near(db, folder, seed, `m.id < ${seed.id} AND ${rawOf("m.")}`);
  if (older.length + 1 < MIN) return null;
  const raw = [...older.slice(0, MAX - 1), seed].sort((a, b) => a.id - b.id);
  const longTerm = near(db, folder, seed, longTermOf("m.")).slice(0, LONG_TERM);
  return { key: TOPICS_KEY, raw, longTerm, newest: seed.id };
}

type Options = {
  /** Seeds from then on, in ms since the epoch. */
  since: number;
  /** A group tried already that hasn't grown. */
  skip: (g: Group) => boolean;
  now: number;
};

/**
 * `folder`'s topic groups ready to consolidate, each seeded by a memory with no
 * file added since the last pass, oldest first. A group's own pass records its
 * seed; seeds before the first group that formed none are recorded here, so
 * none is looked at twice and a group pulled but not passed is found again.
 */
export function* topicGroups(
  db: DatabaseSync,
  folder: string,
  { since, skip, now }: Options,
): Generator<Group> {
  const seeds = memoriesOf(
    db,
    `SELECT * FROM memories WHERE folder = ? AND ${rawOf("")} AND id > ? AND created_at >= ?
     ORDER BY id LIMIT ${SEEDS}`,
    folder,
    lastPass(db, folder, TOPICS_KEY),
    since,
  );
  let passed = 0;
  let open = true;
  const pass = () => {
    if (open && passed) recordPass(db, folder, TOPICS_KEY, passed, now);
    open = false;
  };
  for (const seed of seeds) {
    const group = topicGroup(db, folder, seed);
    if (!group) {
      if (open) passed = seed.id;
      continue;
    }
    pass();
    if (!skip(group)) yield group;
  }
  pass();
}
