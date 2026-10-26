// @vitest-environment node
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { beforeEach, expect, it } from "vitest";
import { readLessonAdded } from "../shared/lessons.ts";
import type { ApprovalAsk } from "./approvalAsk.ts";
import lessons, { LESSON_GUIDANCE } from "./lessonExtension.ts";
import { addLesson, readLessons, removeLesson } from "./lessons.ts";

type Handler = (event: object, ctx: object) => unknown;
type Tool = {
  name: string;
  execute: (
    ...args: unknown[]
  ) => Promise<{ content: { text: string }[]; details?: unknown }>;
};

let file: string;
let settings: string;
let handlers: Record<string, Handler>;
let tools: Record<string, Tool>;
let asks: ApprovalAsk[];
let approve: boolean;
let onAsk: () => void;
const ctx = { cwd: "/repo" };

// The real one would read the user's settings.toml.
const load = () =>
  lessons(
    {
      registerTool: (tool: Tool) => (tools[tool.name] = tool),
      on: (event: string, handler: Handler) => (handlers[event] = handler),
      events: {
        emit: (_channel: string, ask: ApprovalAsk) => {
          asks.push(ask);
          onAsk();
          ask.answer(approve, undefined, undefined, undefined);
        },
      },
    } as unknown as ExtensionAPI,
    file,
    settings,
  );

beforeEach(async () => {
  const dir = mkdtempSync(join(tmpdir(), "lessons-"));
  file = join(dir, "lessons.json");
  settings = join(dir, "settings.toml");
  handlers = {};
  tools = {};
  asks = [];
  approve = true;
  onAsk = () => {};
  await load();
});

const call = (toolName: string, input: object) =>
  handlers.tool_call({ toolName, input }, ctx);
const run = (name: string, params: object) =>
  tools[name].execute("call", params, undefined, undefined, ctx);
const textOf = (result: { content: { text: string }[] }) =>
  result.content[0].text;
const start = async () => {
  const sections: Record<string, string> = {};
  await handlers.before_agent_start({ systemPromptOptions: { sections } }, ctx);
  return sections;
};

it("adds the guidance and every lesson without a match, read once per conversation", async () => {
  addLesson(file, { text: "Be brief", level: "system_prompt" });
  addLesson(file, { text: "Elsewhere", level: "system_prompt", folder: "/x" });
  addLesson(file, { text: "Git only", level: "tool_call", tool: "git" });
  addLesson(file, {
    text: "No -f",
    level: "tool_call",
    tool: "git",
    match: "push -f",
  });
  const first = await start();
  addLesson(file, { text: "Later", level: "system_prompt" });
  expect(first.lessons).toContain(LESSON_GUIDANCE);
  expect(first.lessons).toMatch(
    /Lessons from past mistakes:\n- \[\w+\] Be brief\n- \[\w+\] \(git\) Git only$/,
  );
  expect(await start()).toEqual(first);
});

it("adds only the guidance when there are no system_prompt lessons", async () => {
  expect(await start()).toEqual({ lessons: LESSON_GUIDANCE });
});

it("blocks a matching call every time and never holds other calls", async () => {
  addLesson(file, {
    text: "No --no-verify",
    level: "tool_call",
    tool: "git",
    match: "--no-verify",
  });
  addLesson(file, { text: "Check first", level: "tool_call", tool: "git" });
  const skip = { args: ["commit", "--no-verify"] };
  expect(await call("git", skip)).toMatchObject({
    block: true,
    reason: expect.stringContaining("Blocked by a lesson"),
  });
  expect(await call("git", skip)).toMatchObject({ block: true });
  expect(await call("git", { args: ["status"] })).toBe(undefined);
  expect(await call("bash", { command: "ls" })).toBe(undefined);
  expect(readLessons(file).map((l) => l.hits)).toEqual([2, 0]);
});

it("lesson_add saves without asking, for every folder or this one, and lists similar lessons", async () => {
  const first = await run("lesson_add", {
    text: "A",
    level: "tool_call",
    tool: "git",
  });
  expect(textOf(first)).toMatch(/^Saved lesson \[\w+\]: A$/);
  expect(readLessonAdded(first.details)).toEqual({
    lesson: readLessons(file)[0],
    replaced: undefined,
  });
  const second = await run("lesson_add", {
    text: "B",
    level: "tool_call",
    tool: "git",
    folder_only: true,
  });
  expect(textOf(second)).toContain("merge them with `replaces`");
  expect(readLessons(file).map((l) => l.folder)).toEqual([undefined, "/repo"]);
  expect(asks).toEqual([]);
});

it("lesson_add asks before replacing a lesson", async () => {
  const old = addLesson(file, { text: "Old", level: "system_prompt" });
  approve = false;
  const params = { text: "New", level: "system_prompt", replaces: old.id };
  const declined = await run("lesson_add", params);
  expect(textOf(declined)).toContain("kept the lesson");
  expect(readLessonAdded(declined.details)).toBe(undefined);
  expect(asks[0].request.reason).toContain('"Old" with "New"');
  approve = true;
  const replaced = await run("lesson_add", params);
  expect(readLessons(file).map((l) => l.text)).toEqual(["New"]);
  expect(readLessonAdded(replaced.details)).toMatchObject({
    lesson: { text: "New" },
    replaced: "Old",
  });
});

it("lesson_add claims no replace when the old lesson went while the user was asked", async () => {
  const old = addLesson(file, { text: "Old", level: "system_prompt" });
  onAsk = () => removeLesson(file, old.id);
  const params = { text: "New", level: "system_prompt", replaces: old.id };
  const result = await run("lesson_add", params);
  expect(readLessonAdded(result.details)?.replaced).toBe(undefined);
});

it("lesson_remove asks first, and only for lessons that apply here", async () => {
  const saved = addLesson(file, { text: "A", level: "system_prompt" });
  const other = addLesson(file, {
    text: "B",
    level: "system_prompt",
    folder: "/x",
  });
  await expect(run("lesson_remove", { id: other.id })).rejects.toThrow();
  approve = false;
  await run("lesson_remove", { id: saved.id });
  expect(readLessons(file)).toHaveLength(2);
  approve = true;
  expect(textOf(await run("lesson_remove", { id: saved.id }))).toContain(
    "Removed",
  );
  expect(readLessons(file).map((l) => l.text)).toEqual(["B"]);
});

it("does nothing switched off: no tools, no prompt, no blocking", async () => {
  addLesson(file, {
    text: "No --no-verify",
    level: "tool_call",
    tool: "git",
    match: "--no-verify",
  });
  // Turned off while a conversation runs: from its next run nothing is blocked, saved or removed.
  writeFileSync(settings, "[lessons]\nenabled = false\n");
  expect(await start()).toEqual({});
  expect(await call("git", { args: ["commit", "--no-verify"] })).toBe(
    undefined,
  );
  const saved = await run("lesson_add", { text: "B", level: "system_prompt" });
  expect(textOf(saved)).toMatch(/^Lessons are off/);
  const [kept] = readLessons(file);
  const removed = await run("lesson_remove", { id: kept.id });
  expect(textOf(removed)).toMatch(/^Lessons are off/);
  expect(readLessons(file).map((l) => l.text)).toEqual(["No --no-verify"]);
  expect(asks).toEqual([]);
  // Loaded while off, it registers nothing.
  handlers = {};
  tools = {};
  await load();
  expect(handlers).toEqual({});
  expect(tools).toEqual({});
});
