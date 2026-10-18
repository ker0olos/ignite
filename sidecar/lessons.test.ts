// @vitest-environment node
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_LESSONS,
  addLesson,
  callText,
  lessonFor,
  lessonIn,
  lessonsFor,
  list,
  readLessons,
  recordHit,
  removeLesson,
  type Lesson,
} from "./lessons.ts";
import { regexSpeed } from "./lessonRegex.ts";

let file: string;
beforeEach(() => {
  file = join(mkdtempSync(join(tmpdir(), "lessons-")), "lessons.json");
});

const lesson = (fields: Partial<Lesson>): Lesson => ({
  id: "l1",
  text: "Don't",
  level: "tool_call",
  tool: "git",
  hits: 0,
  ...fields,
});

describe("readLessons", () => {
  it("is empty without a file or with an unreadable one", () => {
    expect(readLessons(file)).toEqual([]);
    writeFileSync(file, "{oops");
    expect(readLessons(file)).toEqual([]);
    writeFileSync(file, "{}");
    expect(readLessons(file)).toEqual([]);
  });

  it("reads the file again once it changes", () => {
    addLesson(file, { text: "A", level: "system_prompt" });
    expect(readLessons(file)).toHaveLength(1);
    writeFileSync(file, "[]");
    expect(readLessons(file)).toEqual([]);
  });
});

describe("addLesson", () => {
  it("saves a lesson and replaces another", () => {
    const first = addLesson(file, { text: "A", level: "system_prompt" });
    const second = addLesson(
      file,
      { text: "B", level: "system_prompt" },
      first.id,
    );
    expect(readLessons(file)).toEqual([second]);
    expect(second).toMatchObject({ text: "B", hits: 0 });
  });

  it("drops a system_prompt lesson's tool and match", () => {
    const saved = addLesson(file, {
      text: "A",
      level: "system_prompt",
      tool: "git",
      match: "push",
    });
    expect(saved).not.toHaveProperty("tool");
    expect(saved).not.toHaveProperty("match");
  });

  it("refuses a tool_call lesson without a tool or with a short match", () => {
    expect(() => addLesson(file, { text: "A", level: "tool_call" })).toThrow(
      "needs `tool`",
    );
    for (const match of ["", " . "]) {
      expect(() =>
        addLesson(file, { text: "A", level: "tool_call", tool: "git", match }),
      ).toThrow("at least 3");
    }
  });

  it("refuses a lesson when its scope is full, listing the others", () => {
    for (let i = 0; i < MAX_LESSONS; i++)
      addLesson(file, { text: `L${i}`, level: "system_prompt" });
    addLesson(file, { text: "Here", level: "system_prompt", folder: "/f" });
    expect(() =>
      addLesson(file, { text: "X", level: "system_prompt" }),
    ).toThrow(/Merge this[\s\S]*L29/);
  });
});

it("lessonIn finds only lessons that apply in the folder", () => {
  const mine = addLesson(file, { text: "A", level: "system_prompt" });
  const theirs = addLesson(file, {
    text: "B",
    level: "system_prompt",
    folder: "/b",
  });
  expect(lessonIn(file, "/a", mine.id)).toEqual(mine);
  expect(() => lessonIn(file, "/a", theirs.id)).toThrow("No lesson");
});

it("removeLesson removes one", () => {
  const saved = addLesson(file, { text: "A", level: "system_prompt" });
  removeLesson(file, saved.id);
  expect(readLessons(file)).toEqual([]);
});

it("recordHit counts a lesson's blocks", () => {
  const saved = addLesson(file, { text: "A", level: "tool_call", tool: "git" });
  recordHit(file, saved.id, 5);
  recordHit(file, "nope", 6);
  expect(readLessons(file)[0]).toMatchObject({ hits: 1, lastHit: 5 });
});

it("lessonsFor keeps global lessons and the folder's", () => {
  const all = [
    lesson({ id: "g" }),
    lesson({ id: "a", folder: "/a" }),
    lesson({ id: "b", folder: "/b" }),
  ];
  expect(lessonsFor(all, "/a").map((l) => l.id)).toEqual(["g", "a"]);
});

it("list shows ids and triggers", () => {
  expect(
    list([
      lesson({ match: "--no-verify", text: "No hooks skipped" }),
      lesson({
        id: "l2",
        level: "system_prompt",
        tool: undefined,
        text: "Short",
      }),
    ]),
  ).toBe('- [l1] (git: "--no-verify") No hooks skipped\n- [l2] Short');
});

it("callText joins argument values, leaving out the reason", () => {
  expect(
    callText({
      args: ["push", "--force"],
      n: 2,
      reason: "--force",
      nested: { on: true, x: "y" },
    }),
  ).toBe("push --force 2  y");
});

describe("lessonFor", () => {
  const noVerify = lesson({ id: "nv", match: "--no-verify" });
  const remind = lesson({ id: "r" });
  const commit = { args: ["commit", "-m", "x"] };

  it("finds a matching call's lesson every time", () => {
    const input = { args: ["commit", "--no-verify"] };
    const seen = new Set(["nv"]);
    expect(lessonFor([remind, noVerify], "git", input, seen)?.id).toBe("nv");
  });

  it("matches across array arguments but not the reason", () => {
    const force = lesson({ id: "f", match: "push --force" });
    const push = { args: ["push", "--force"] };
    expect(lessonFor([force], "git", push, new Set())?.id).toBe("f");
    const why = { args: ["push"], reason: "push --force is wrong" };
    expect(lessonFor([force], "git", why, new Set())).toBe(undefined);
  });

  it("reminds of a lesson without a match once", () => {
    expect(lessonFor([noVerify, remind], "git", commit, new Set())?.id).toBe(
      "r",
    );
    expect(lessonFor([noVerify, remind], "git", commit, new Set(["r"]))).toBe(
      undefined,
    );
  });

  it("only looks at the called tool's tool_call lessons", () => {
    const prompt = lesson({ id: "p", level: "system_prompt" });
    expect(lessonFor([remind, prompt], "bash", commit, new Set())).toBe(
      undefined,
    );
    expect(lessonFor([prompt], "git", commit, new Set())).toBe(undefined);
  });

  it("matches an MCP call by its server tool or the tool it calls", () => {
    const issue = lesson({ id: "i", tool: "create_issue" });
    const input = { tool: "create_issue", args: "{}" };
    expect(lessonFor([issue], "mcp__github", input, new Set())?.id).toBe("i");
    expect(lessonFor([issue], "mcp", input, new Set())?.id).toBe("i");
  });
});

describe("regex lessons", () => {
  const force = lesson({
    id: "f",
    match: "push.*(-f|--force)(\\s|$)",
    regex: true,
  });

  it("blocks every spelling a regex catches, and only those", () => {
    const call = (...args: string[]) =>
      lessonFor([force], "git", { args }, new Set())?.id;
    expect(call("push", "-f")).toBe("f");
    expect(call("push", "origin", "main", "--force")).toBe("f");
    expect(call("push", "--force-with-lease")).toBe(undefined);
    expect(call("pull", "-f")).toBe(undefined);
  });

  it("sees a whole call, across lines, unless it's quadratic", () => {
    const late = { args: ["push", "x".repeat(5_000), "-f"] };
    expect(lessonFor([force], "git", late, new Set())?.id).toBe("f");
    const slow = { ...force, quadratic: true };
    expect(lessonFor([slow], "git", late, new Set())).toBe(undefined);
    const lines = { command: "git push origin main \\\n  --force" };
    expect(
      lessonFor([{ ...force, tool: "bash" }], "bash", lines, new Set())?.id,
    ).toBe("f");
  });

  it("skips a broken saved regex", () => {
    const broken = lesson({ id: "b", match: "push(", regex: true });
    expect(lessonFor([broken], "git", { args: ["push("] }, new Set())).toBe(
      undefined,
    );
  });

  it("saves a regex marked by its speed, and refuses one that's invalid, too broad or slow", () => {
    const add = (match: string) =>
      addLesson(file, {
        text: "A",
        level: "tool_call",
        tool: "git",
        match,
        regex: true,
      });
    expect(add("push.*(-f|--force)(\\s|$)")).toMatchObject({
      regex: true,
      quadratic: true,
    });
    expect(add("--no-verify\\b")).not.toHaveProperty("quadratic");
    expect(() => add("push(")).toThrow("isn't a valid regex");
    expect(() => add("^.*")).toThrow("would block every call");
    expect(() => add("...")).toThrow("would block every call");
    expect(() => add("(a+)+$")).toThrow("could hang");
  });

  it("refuses a regex the checker can't judge", () => {
    const unknown = () =>
      ({ status: "unknown", error: { kind: "timeout" } }) as never;
    expect(regexSpeed("push", unknown)).toBe(
      "`match` couldn't be checked for speed (timeout). Write a simpler regex.",
    );
  });

  it("keeps plain text plain", () => {
    const saved = addLesson(file, {
      text: "A",
      level: "tool_call",
      tool: "git",
      match: "a.c",
    });
    expect(saved).not.toHaveProperty("regex");
    expect(lessonFor([saved], "git", { args: ["abc"] }, new Set())).toBe(
      undefined,
    );
    expect(list([force])).toBe(
      "- [f] (git: /push.*(-f|--force)(\\s|$)/) Don't",
    );
  });
});
