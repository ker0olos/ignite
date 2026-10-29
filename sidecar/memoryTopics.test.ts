// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { consolidationPrompt } from "./memoryConsolidatePrompt.ts";
import { addMemories, memoryDb, type NewMemory } from "./memoryDb.ts";
import { applyOutcome, groups, isFileKey, type Group } from "./memoryGroups.ts";
import { lastPass } from "./memoryPasses.ts";
import { memory } from "./testMemory.ts";
import { sameTopic, TOPICS_KEY, topicGroups } from "./memoryTopics.ts";

let dir: string;
let db: DatabaseSync;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "memory-topics-"));
  db = memoryDb(join(dir, "memory.db"));
});
afterEach(async () => {
  db.close();
  await rm(dir, { recursive: true, force: true });
});

const FOLDER = "/work/app";
const NOW = 100 * 864e5;

const HELD = [
  "motr-agent-rules main is held by a worktree, so checkout fails",
  "motr-agent-rules main is locked to another worktree",
  "Rules repo main is checked out in another worktree, blocking checkout",
];
const OTHER = "Invoice PDF opens in a new tab";

const add = (titles: string[], over: Partial<NewMemory> = {}) =>
  addMemories(
    db,
    titles.map((title, i) =>
      memory({ title, createdAt: NOW - (titles.length - i) * 1e3, ...over }),
    ),
  );

const all = (skip: (g: Group) => boolean = () => false) => [
  ...topicGroups(db, FOLDER, { since: 0, skip, now: NOW }),
];
const ids = (g: Group | undefined) => g?.raw.map((m) => m.id);
const passed = (g: Group) =>
  applyOutcome(db, FOLDER, g, { entries: [], stale: [] }, NOW);

describe("sameTopic", () => {
  it("takes titles sharing half the shorter one's words, word starts alike", () => {
    expect(sameTopic(HELD[0]!, HELD[2]!)).toBe(true);
    expect(sameTopic("Tests checked", "Checkout the tests")).toBe(true);
    expect(sameTopic(HELD[0]!, OTHER)).toBe(false);
    // One shared word isn't a topic, nor are short and common ones.
    expect(sameTopic("Worktree", "Worktree")).toBe(false);
    expect(sameTopic("with from that main", "with from that main")).toBe(false);
  });
});

describe("topicGroups", () => {
  it("groups a memory with no file and the older ones on its topic", () => {
    add([HELD[0]!, OTHER, HELD[1]!, HELD[2]!]);
    const [group, ...rest] = all();
    expect(rest).toEqual([]);
    expect(group!.key).toBe(TOPICS_KEY);
    expect(ids(group)).toEqual([1, 3, 4]);
    expect(group!.newest).toBe(4);
    expect(isFileKey(TOPICS_KEY)).toBe(false);
    expect(isFileKey("#notes.md")).toBe(true);
  });

  it("offers a group again until its pass records it, and the seeds before it once", () => {
    add([OTHER, OTHER, ...HELD]);
    const [group] = all();
    // The seeds with no group before it are recorded; its own isn't, until passed.
    expect(lastPass(db, FOLDER, TOPICS_KEY)).toBe(4);
    expect(ids(all()[0])).toEqual(ids(group));
    expect(passed(group!)).toBe(true);
    expect(all()).toEqual([]);
    add([HELD[0]!]);
    expect(ids(all()[0])).toEqual([3, 4, 5, 6]);
  });

  it("goes past a group tried already that hasn't grown", () => {
    add(HELD);
    add([`${OTHER} again`, `${OTHER} once more`, `${OTHER} still`]);
    const [first, second] = all();
    expect(ids(second)).toEqual([4, 5, 6]);
    expect(ids(all((g) => g.newest === first!.newest)[0])).toEqual([4, 5, 6]);
  });

  it("keeps the seed in its group however many older ones match", () => {
    add(Array.from({ length: 20 }, () => HELD[0]!));
    const group = all().at(-1)!;
    expect(group.raw).toHaveLength(12);
    expect(group.raw.at(-1)!.id).toBe(20);
  });

  it("leaves out memories with a file, procedures, summaries, long-term and old ones", () => {
    add(HELD.slice(0, 2));
    add([HELD[2]!], { filesModified: ["a.ts"] });
    add([HELD[2]!], { concepts: ["procedure"] });
    add([HELD[2]!], { type: "summary" });
    add([HELD[2]!], { concepts: ["consolidated"] });
    expect(all()).toEqual([]);
    add([HELD[2]!], { createdAt: -1 });
    expect([
      ...topicGroups(db, FOLDER, { since: 0, skip: () => false, now: NOW }),
    ]).toEqual([]);
  });

  it("brings the topic's long-term memories along", () => {
    add([HELD[0]!], { concepts: ["consolidated"] });
    add(HELD);
    const [group] = all();
    expect(group!.longTerm.map((m) => m.id)).toEqual([1]);
    expect(ids(group)).toEqual([2, 3, 4]);
  });

  it("takes turns with files' groups, after the procedures", () => {
    add(
      Array.from({ length: 8 }, (_, i) => `a.ts change ${i}`),
      { filesModified: ["a.ts"] },
    );
    add(HELD);
    const keys = [...groups(db, FOLDER, { now: NOW })].map((g) => g.key);
    expect(keys).toEqual(["a.ts", TOPICS_KEY]);
  });
});

it("tells the model a topic's memories have no file and may only sound alike", () => {
  const prompt = consolidationPrompt({
    key: TOPICS_KEY,
    raw: [],
    longTerm: [],
    newest: 4,
  });
  expect(prompt).toContain("name no file");
  expect(prompt).toContain("others only sound alike");
});
