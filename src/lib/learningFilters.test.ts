import { describe, expect, it } from "vitest";
import type { Lesson } from "../../shared/lessons";
import type { Procedure } from "../../shared/procedures";
import type { Reflection } from "../../shared/reflector";
import {
  activeFilter,
  filterLessons,
  filterProcedures,
  filterReflections,
  lessonChips,
  procedureChips,
  reflectionChips,
} from "./learningFilters";

const lesson = (id: string, over: Partial<Lesson> = {}): Lesson => ({
  id,
  text: `Lesson ${id}`,
  level: "system_prompt",
  hits: 0,
  ...over,
});

const lessons = [
  lesson("a", { folder: "/p/tempo", text: "Run tests first" }),
  lesson("b", { folder: "/p/tempo", tool: "git", match: "--force" }),
  lesson("c", { folder: "/p/pantry" }),
  lesson("d"),
];

describe("lessons", () => {
  it("counts chips by folder, most first then by name; a lesson for every folder only under All", () => {
    expect(lessonChips(lessons)).toEqual([
      { id: null, label: "All", count: 4 },
      { id: "folder:/p/tempo", label: "tempo", count: 2 },
      { id: "folder:/p/pantry", label: "pantry", count: 1 },
    ]);
  });

  it("filters by chip, and by text, tool or match", () => {
    // No chip picks out the lessons for every folder, so that pick is All.
    expect(filterLessons(lessons, "", "every")).toHaveLength(4);
    expect(
      filterLessons(lessons, "", "folder:/p/tempo").map((l) => l.id),
    ).toEqual(["a", "b"]);
    expect(filterLessons(lessons, "", null)).toHaveLength(4);
    expect(filterLessons(lessons, "TESTS", null).map((l) => l.id)).toEqual([
      "a",
    ]);
    expect(filterLessons(lessons, "git", null).map((l) => l.id)).toEqual(["b"]);
    expect(filterLessons(lessons, "force", null).map((l) => l.id)).toEqual([
      "b",
    ]);
    expect(filterLessons(lessons, "lesson", "folder:/p/pantry")).toHaveLength(
      1,
    );
    expect(filterLessons(lessons, "zzz", null)).toEqual([]);
  });

  it("treats a chip that is gone as All", () => {
    expect(activeFilter(lessonChips(lessons), "folder:/gone")).toBeNull();
    expect(filterLessons(lessons, "", "folder:/gone")).toHaveLength(4);
  });
});

describe("procedures", () => {
  const proc = (id: number, folder: string, over = {}): Procedure => ({
    id,
    title: `Fix ${id}`,
    steps: ["Install"],
    folder,
    at: id,
    ...over,
  });
  const list = [
    proc(1, "/p/tempo", { steps: ["Run vitest"] }),
    proc(2, "/p/pantry"),
    proc(3, "/p/pantry"),
  ];

  it("chips by folder", () => {
    expect(procedureChips(list).map((c) => [c.label, c.count])).toEqual([
      ["All", 3],
      ["pantry", 2],
      ["tempo", 1],
    ]);
  });

  it("names the parent folder too when two folders share a name", () => {
    const same = [
      proc(1, "/work/a/app"),
      proc(2, "/work/b/app"),
      proc(3, "/p/tempo"),
    ];
    expect(procedureChips(same).map((c) => c.label)).toEqual([
      "All",
      "a/app",
      "b/app",
      "tempo",
    ]);
  });

  it("matches title, steps and folder name", () => {
    expect(filterProcedures(list, "fix 2", null).map((p) => p.id)).toEqual([2]);
    expect(filterProcedures(list, "vitest", null).map((p) => p.id)).toEqual([
      1,
    ]);
    expect(filterProcedures(list, "TEMPO", null).map((p) => p.id)).toEqual([1]);
    expect(
      filterProcedures(list, "", "folder:/p/pantry").map((p) => p.id),
    ).toEqual([2, 3]);
  });
});

describe("reflections", () => {
  const point = (id: string, entry: Reflection["entry"], over = {}) =>
    ({
      id,
      text: `Point ${id}`,
      entry,
      taught: "reply",
      at: 1,
      ...over,
    }) as Reflection;
  const list = [
    point("a", "delivering"),
    point("b", "always", { when: "reporting findings" }),
    point("c", "delivering", { evidence: "stop asking" }),
  ];

  it("chips only entry points with points, in entry point order", () => {
    expect(reflectionChips(list).map((c) => [c.label, c.count])).toEqual([
      ["All", 3],
      ["In general", 1],
      ["When delivering", 2],
    ]);
  });

  it("matches text, when and evidence", () => {
    expect(filterReflections(list, "findings", null).map((r) => r.id)).toEqual([
      "b",
    ]);
    expect(filterReflections(list, "stop", null).map((r) => r.id)).toEqual([
      "c",
    ]);
    expect(
      filterReflections(list, "point", "delivering").map((r) => r.id),
    ).toEqual(["a", "c"]);
  });
});
