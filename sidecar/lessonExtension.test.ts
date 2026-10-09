// @vitest-environment node
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { beforeEach, expect, it } from "vitest";
import type { ApprovalAsk } from "./approvalExtension.ts";
import lessons, { LESSON_GUIDANCE } from "./lessonExtension.ts";
import { addLesson, readLessons } from "./lessons.ts";

type Handler = (event: object, ctx: object) => unknown;
type Tool = {
  name: string;
  execute: (...args: unknown[]) => Promise<{ content: { text: string }[] }>;
};

let file: string;
let handlers: Record<string, Handler>;
let tools: Record<string, Tool>;
let asks: ApprovalAsk[];
let approve: boolean;
const ctx = { cwd: "/repo" };

beforeEach(() => {
  file = join(mkdtempSync(join(tmpdir(), "lessons-")), "lessons.json");
  handlers = {};
  tools = {};
  asks = [];
  approve = true;
  lessons(
    {
      registerTool: (tool: Tool) => (tools[tool.name] = tool),
      on: (event: string, handler: Handler) => (handlers[event] = handler),
      events: {
        emit: (_channel: string, ask: ApprovalAsk) => {
          asks.push(ask);
          ask.answer(approve, undefined, undefined, undefined);
        },
      },
    } as unknown as ExtensionAPI,
    file,
  );
});

const call = (toolName: string, input: object) =>
  handlers.tool_call({ toolName, input }, ctx);
const run = (name: string, params: object) =>
  tools[name].execute("call", params, undefined, undefined, ctx);
const textOf = (result: { content: { text: string }[] }) =>
  result.content[0].text;

it("adds the guidance and the system_prompt lessons, read once per conversation", () => {
  addLesson(file, { text: "Be brief", level: "system_prompt" });
  addLesson(file, { text: "Elsewhere", level: "system_prompt", folder: "/x" });
  addLesson(file, { text: "Git only", level: "tool_call", tool: "git" });
  const first = handlers.before_agent_start({ systemPrompt: "Base" }, ctx);
  addLesson(file, { text: "Later", level: "system_prompt" });
  const second = handlers.before_agent_start({ systemPrompt: "Base" }, ctx);
  const prompt = (first as { systemPrompt: string }).systemPrompt;
  expect(prompt).toContain(LESSON_GUIDANCE);
  expect(prompt).toMatch(/Lessons from past mistakes:\n- \[\w+\] Be brief$/);
  expect(second).toEqual(first);
});

it("adds only the guidance when there are no system_prompt lessons", () => {
  expect(handlers.before_agent_start({ systemPrompt: "Base" }, ctx)).toEqual({
    systemPrompt: `Base\n\n${LESSON_GUIDANCE}`,
  });
});

it("blocks a matching call every time and holds an unmatched tool once", () => {
  addLesson(file, {
    text: "No --no-verify",
    level: "tool_call",
    tool: "git",
    match: "--no-verify",
  });
  addLesson(file, { text: "Check first", level: "tool_call", tool: "git" });
  const skip = { args: ["commit", "--no-verify"] };
  expect(call("git", skip)).toMatchObject({
    block: true,
    reason: expect.stringContaining("Blocked by a lesson"),
  });
  expect(call("git", skip)).toMatchObject({ block: true });
  expect(call("git", { args: ["status"] })).toMatchObject({
    reason: expect.stringContaining("Held by a lesson"),
  });
  expect(call("git", { args: ["status"] })).toBe(undefined);
  expect(call("bash", { command: "ls" })).toBe(undefined);
  expect(readLessons(file).map((l) => l.hits)).toEqual([2, 1]);
});

it("lesson_add saves without asking, for every folder or this one, and lists similar lessons", async () => {
  const first = await run("lesson_add", {
    text: "A",
    level: "tool_call",
    tool: "git",
  });
  expect(textOf(first)).toMatch(/^Saved lesson \[\w+\]\.$/);
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
  expect(textOf(await run("lesson_add", params))).toContain("kept the lesson");
  expect(asks[0].request.reason).toContain('"Old" with "New"');
  approve = true;
  await run("lesson_add", params);
  expect(readLessons(file).map((l) => l.text)).toEqual(["New"]);
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
