// @vitest-environment node
import { describe, expect, it } from "vitest";
import { APP_NAME } from "../src/lib/app.ts";
import { memory } from "./testMemory.ts";
import type { Memory } from "./memoryDb.ts";
import {
  consolidationPrompt,
  memberLines,
  parseOutcome,
} from "./memoryConsolidatePrompt.ts";
import { PROCEDURES_KEY, type Group } from "./memoryGroups.ts";

const FOLDER = "/work/app";
const m = (id: number, over: Partial<Memory> = {}): Memory => ({
  ...memory({ title: `m${id}`, createdAt: id * 1000 }),
  id,
  ...over,
});
const group = (key = "src/a.ts"): Group => ({
  key,
  raw: [m(1), m(2), m(3)],
  longTerm: [m(9, { createdAt: 50_000 })],
  newest: 3,
});
const reply = (body: object) => `Here you go:\n${JSON.stringify(body)}\nDone.`;
const entry = (sources: unknown, over: object = {}) => ({
  type: "bugfix",
  title: "Merged",
  facts: ["f"],
  concepts: ["gotcha"],
  sources,
  ...over,
});

describe("parseOutcome", () => {
  it("is null for a reply that isn't JSON", () => {
    expect(parseOutcome("no idea", FOLDER, group())).toBeNull();
    expect(parseOutcome("{broken", FOLDER, group())).toBeNull();
  });

  it("is empty for JSON with neither entries nor stale", () => {
    expect(parseOutcome("{}", FOLDER, group())).toEqual({
      entries: [],
      stale: [],
    });
  });

  it("reads an entry as a long-term memory made of its sources", () => {
    const g = group();
    g.raw[0] = m(1, { filesRead: [`${FOLDER}/a.ts`, "/etc/x"] });
    g.raw[1] = m(2, {
      filesRead: ["a.ts", "b.ts"],
      filesModified: [`${FOLDER}/src/a.ts`, "./src/c.ts"],
    });
    const out = parseOutcome(reply({ entries: [entry([1, 2, 2])] }), FOLDER, g);
    expect(out!.entries).toEqual([
      {
        type: "bugfix",
        title: "Merged",
        subtitle: null,
        facts: ["f"],
        narrative: null,
        concepts: ["gotcha", "consolidated"],
        filesRead: ["a.ts", "b.ts"],
        filesModified: ["src/a.ts", "src/c.ts"],
        folder: FOLDER,
        conversation: null,
        platform: APP_NAME,
        createdAt: 2_000,
        sources: [1, 2],
      },
    ]);
  });

  it("drops entries citing none of the group, ignoring ids outside it", () => {
    const out = parseOutcome(
      reply({
        entries: [
          entry([77]),
          entry([]),
          entry("1"),
          entry([1, 77], { title: "Kept" }),
          entry([2], { title: "" }),
          "text",
        ],
      }),
      FOLDER,
      group(),
    );
    expect(out!.entries.map((e) => [e.title, e.sources])).toEqual([
      ["Kept", [1]],
    ]);
  });

  it("makes a procedures' entry a discovery with the procedure concept", () => {
    const body = reply({ entries: [entry([1], { concepts: ["procedure"] })] });
    const [proc] = parseOutcome(body, FOLDER, group(PROCEDURES_KEY))!.entries;
    expect(proc.type).toBe("discovery");
    expect(proc.concepts).toEqual(["procedure", "consolidated"]);
    const [file] = parseOutcome(body, FOLDER, group())!.entries;
    expect(file.type).toBe("bugfix");
    expect(file.concepts).toEqual(["consolidated"]);
  });

  it("marks stale members with a reason, never one an entry cites", () => {
    const out = parseOutcome(
      reply({
        entries: [entry([1])],
        stale: [
          { id: 1, reason: "cited" },
          { id: 2, reason: "  gone  " },
          { id: 3, reason: "   " },
          { id: 3 },
          { id: 9, reason: "long-term too" },
          { id: 77, reason: "outside" },
          null,
        ],
      }),
      FOLDER,
      group(),
    );
    expect(out!.stale).toEqual([
      { id: 2, reason: "gone" },
      { id: 9, reason: "long-term too" },
    ]);
  });

  it("keeps at most 8 entries, the ones cited not stale", () => {
    const g: Group = {
      key: "src/a.ts",
      raw: Array.from({ length: 12 }, (_, i) => m(i + 1)),
      longTerm: [],
      newest: 12,
    };
    const out = parseOutcome(
      reply({
        entries: Array.from({ length: 10 }, (_, i) =>
          entry([i + 1], { title: `e${i}` }),
        ),
        stale: g.raw.map(({ id }) => ({ id, reason: "r" })),
      }),
      FOLDER,
      g,
    );
    expect(out!.entries).toHaveLength(8);
    expect(out!.stale).toHaveLength(4);
    expect(out!.stale.map((s) => s.id)).toEqual([9, 10, 11, 12]);
  });

  it("never retires a member the model read cut short", () => {
    const g = group();
    g.raw[0] = m(1, { narrative: "x".repeat(4_000) });
    const out = parseOutcome(
      reply({
        entries: [entry([1]), entry([1, 2], { title: "Kept" })],
        stale: [{ id: 1, reason: "r" }],
      }),
      FOLDER,
      g,
    );
    expect(out!.entries.map((e) => [e.title, e.sources])).toEqual([
      ["Kept", [2]],
    ]);
    expect(out!.stale).toEqual([]);
  });

  it("caps stale at 10", () => {
    const g: Group = {
      key: "src/a.ts",
      raw: Array.from({ length: 14 }, (_, i) => m(i + 1)),
      longTerm: [],
      newest: 14,
    };
    const stale = g.raw.map(({ id }) => ({ id, reason: "r" }));
    expect(parseOutcome(reply({ stale }), FOLDER, g)!.stale).toHaveLength(10);
  });
});

describe("consolidationPrompt", () => {
  it("asks for JSON, about a file or about procedures", () => {
    const file = consolidationPrompt(group());
    const proc = consolidationPrompt(group(PROCEDURES_KEY));
    for (const p of [file, proc]) expect(p).toContain("Reply with JSON only");
    expect(file).toContain("as it is now");
    expect(proc).toContain("procedures");
    expect(proc).not.toContain("as it is now");
  });
});

describe("memberLines", () => {
  it("lists long-term members first, then the raw ones as given", () => {
    const g = group();
    g.raw[0] = m(1, {
      createdAt: Date.UTC(2026, 9, 5),
      subtitle: "sub",
      facts: ["a", "b"],
      narrative: "story",
    });
    const text = memberLines(g);
    expect(text).toMatch(/^The memories:\n\n\[9\] .* \(long-term\) · m9/);
    expect(text.indexOf("[9]")).toBeLessThan(text.indexOf("[1]"));
    expect(text.indexOf("[1]")).toBeLessThan(text.indexOf("[2]"));
    expect(text).toContain(
      "[1] 2026-10-05 discovery · m1\nsub\n- a\n- b\nstory",
    );
    expect(text).not.toContain("[2] 1970-01-01 discovery (long-term)");
  });

  it("cuts a long member at 3000 characters", () => {
    const g: Group = {
      key: "k",
      raw: [m(1, { narrative: "x".repeat(4_000) })],
      longTerm: [],
      newest: 1,
    };
    const block = memberLines(g).split("\n\n")[1];
    expect(block.length).toBe(3_001);
    expect(block.endsWith("…")).toBe(true);
  });
});
