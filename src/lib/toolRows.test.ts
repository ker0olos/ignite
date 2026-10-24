import { describe, expect, it } from "vitest";
import type { AssistantMessage, ToolCall } from "../../shared/agentTypes";
import {
  canSkipWait,
  inArrivalOrder,
  waitingCalls,
  diffSummary,
  isShortOutput,
  outputPreview,
  parseDiff,
  showsNothingYet,
  toRows,
} from "./toolRows";
import type { Item } from "./transcript";

const call = (name: string, id = name): ToolCall => ({
  type: "toolCall",
  id,
  name,
  arguments: {},
});

const assistant = (
  content: AssistantMessage["content"],
  stopReason: AssistantMessage["stopReason"] = "toolUse",
): Item => ({
  kind: "message",
  message: {
    role: "assistant",
    content,
    provider: "p",
    model: "m",
    stopReason,
    errorMessage: "boom",
    timestamp: 0,
  },
});

describe("toRows", () => {
  it("shows every tool call as its own row", () => {
    const rows = toRows([
      assistant([call("read", "a")]),
      assistant([call("bash", "b"), call("grep", "c"), call("edit", "d")]),
    ]);
    expect(rows).toEqual([
      { kind: "tool", call: call("read", "a") },
      { kind: "tool", call: call("bash", "b") },
      { kind: "tool", call: call("grep", "c") },
      { kind: "tool", call: call("edit", "d") },
    ]);
  });

  it("shows only the latest of plan updates in a row, once it has a plan", () => {
    const plan = (status: "done" | "error", subtasks = [{}]) => ({
      status,
      result: { content: [], details: { subtasks } },
    });
    const rows = toRows(
      [
        assistant([call("task_update", "a"), call("task_update", "b")]),
        assistant([call("task_update", "c"), call("task_update", "d")]),
        assistant([call("task_update", "e"), call("read")]),
      ],
      { a: plan("done"), b: plan("done"), c: plan("done"), e: plan("done") },
    );
    expect(rows).toEqual([
      { kind: "tool", call: call("task_update", "c") },
      { kind: "tool", call: call("task_update", "d") },
      { kind: "tool", call: call("task_update", "e") },
      { kind: "tool", call: call("read") },
    ]);
  });

  it("puts one MCP server's calls under one tile, and keeps subagents a row each", () => {
    const mcp = (id: string) => ({
      ...call("mcp__clickup", id),
      arguments: { tool: "get_task" },
    });
    const rows = toRows([
      assistant([
        mcp("a"),
        mcp("b"),
        call("subagent", "c"),
        call("subagent", "d"),
      ]),
    ]);
    expect(rows.map((r) => r.kind)).toEqual(["calls", "tool", "tool"]);
  });

  it("text sits between tool rows", () => {
    const rows = toRows([
      assistant([
        call("read", "a"),
        { type: "text", text: "hm" },
        call("read", "b"),
      ]),
    ]);
    expect(rows.map((r) => r.kind)).toEqual(["tool", "text", "tool"]);
  });

  it("shows no row for thinking", () => {
    const rows = toRows([
      assistant([{ type: "thinking", thinking: "why" }], "stop"),
    ]);
    expect(rows).toEqual([]);
  });

  it("skips empty text", () => {
    const rows = toRows([assistant([{ type: "text", text: "" }], "stop")]);
    expect(rows).toEqual([]);
  });

  it("passes notices and user messages through", () => {
    const user = { role: "user" as const, content: "hi", timestamp: 0 };
    const rows = toRows([
      { kind: "notice", text: "note" },
      { kind: "message", message: user },
    ]);
    expect(rows).toEqual([
      { kind: "notice", text: "note" },
      { kind: "user", message: user },
    ]);
  });

  it("ends an errored or aborted message with an end row", () => {
    expect(toRows([assistant([], "error")]).map((r) => r.kind)).toEqual([
      "end",
    ]);
    expect(toRows([assistant([], "aborted")]).map((r) => r.kind)).toEqual([
      "end",
    ]);
    expect(toRows([assistant([], "stop")])).toEqual([]);
  });

  it("leaves out an errored message's text that repeats its error", () => {
    const rows = toRows([
      assistant(
        [
          { type: "text", text: "boom" },
          { type: "text", text: "other" },
        ],
        "error",
      ),
    ]);
    expect(rows.map((r) => r.kind)).toEqual(["text", "end"]);
  });

  it("keeps text equal to an error the end row doesn't show", () => {
    const text = { type: "text" as const, text: "boom" };
    expect(toRows([assistant([text], "aborted")])[0]?.kind).toBe("text");
    expect(toRows([assistant([text], "toolUse")])[0]?.kind).toBe("text");
  });
});

describe("parseDiff", () => {
  it("reads added, removed, context and gap lines", () => {
    const diff = [
      "  1 keep",
      "-22 old",
      "+22 new",
      "+23   indented 42 ",
      "+24 ",
      "    ...",
    ].join("\n");
    expect(parseDiff(diff)).toEqual([
      { kind: "ctx", num: 1, text: "keep" },
      { kind: "del", num: 22, text: "old" },
      { kind: "add", num: 22, text: "new" },
      { kind: "add", num: 23, text: "  indented 42 " },
      { kind: "add", num: 24, text: "" },
      { kind: "gap" },
    ]);
  });
});

describe("diffSummary", () => {
  it("counts added and removed lines", () => {
    expect(diffSummary(parseDiff("-1 a\n+1 b\n+2 c"))).toBe(
      "Added 2 lines, removed 1 line",
    );
    expect(diffSummary(parseDiff("+1 b"))).toBe("Added 1 line");
    expect(diffSummary(parseDiff("-1 a\n-2 b"))).toBe("Removed 2 lines");
    expect(diffSummary([])).toBe("No changes");
  });
});

describe("outputPreview", () => {
  it("shows short output whole", () => {
    expect(outputPreview("a\nb\n", 5, 100)).toEqual({
      text: "a\nb",
      hidden: 0,
    });
  });

  it("cuts at the line cap", () => {
    expect(outputPreview("a\nb\nc\nd", 2, 100)).toEqual({
      text: "a\nb",
      hidden: 2,
    });
  });

  it("cuts one long line at the character cap", () => {
    expect(outputPreview("x".repeat(50), 5, 10)).toEqual({
      text: `${"x".repeat(10)}…`,
      hidden: 1,
    });
  });

  it("counts the cut line as hidden", () => {
    expect(outputPreview("ab\ncdef\ng", 5, 5)).toEqual({
      text: "ab\ncd…",
      hidden: 2,
    });
  });
});

describe("isShortOutput", () => {
  it("is one line that fits", () => {
    expect(isShortOutput("Already up to date.\n")).toBe(true);
    expect(isShortOutput("a\nb")).toBe(false);
    expect(isShortOutput("x".repeat(121))).toBe(false);
  });
});

describe("canSkipWait", () => {
  const running = { status: "running" } as const;
  const bash = (command: string, background?: boolean) => ({
    ...call("bash"),
    arguments: { command, background },
  });

  it("offers it on a running foreground bash command that sleeps", () => {
    expect(canSkipWait(bash("sleep 60 && gh run view"), running)).toBe(true);
    expect(canSkipWait(bash("until ok; do sleep 5; done"), running)).toBe(true);
    expect(canSkipWait(bash("sleep 60"), { status: "done" })).toBe(false);
  });

  it("not on one that doesn't sleep, other tools, background commands or ones waiting for approval", () => {
    expect(canSkipWait(bash("npm test"), running)).toBe(false);
    expect(canSkipWait(bash("grep sleepy src"), running)).toBe(false);
    expect(canSkipWait(call("read"), running)).toBe(false);
    expect(canSkipWait(bash("sleep 60", true), running)).toBe(false);
    expect(canSkipWait(bash("sleep 60"), { ...running, approval: {} })).toBe(
      false,
    );
  });
});

describe("showsNothingYet", () => {
  const running = { status: "running" } as const;

  it("is true for a running call with no output yet", () => {
    expect(showsNothingYet(call("read"), running, "", false)).toBe(true);
    expect(showsNothingYet(call("bash"), running, "", false)).toBe(true);
  });

  it("is false once there is something to show", () => {
    expect(showsNothingYet(call("read"), { status: "done" }, "", false)).toBe(
      false,
    );
    expect(showsNothingYet(call("bash"), running, "out", false)).toBe(false);
    expect(showsNothingYet(call("bash"), running, "", true)).toBe(false);
    const asking = { ...running, approval: {} };
    expect(showsNothingYet(call("bash"), asking, "", false)).toBe(false);
  });

  it("is false for calls that draw while they run", () => {
    expect(showsNothingYet(call("write"), running, "", false)).toBe(false);
    expect(showsNothingYet(call("subagent"), running, "", false)).toBe(false);
    const review = { files: [], commits: [] } as never;
    expect(
      showsNothingYet(call("git"), { ...running, review }, "", false),
    ).toBe(false);
  });
});

describe("waitingCalls", () => {
  const call = (id: string): ToolCall => ({
    type: "toolCall",
    id,
    name: "bash",
    arguments: {},
  });
  const turn = (...calls: ToolCall[]): Item => ({
    kind: "message",
    message: {
      role: "assistant",
      content: calls,
      provider: "p",
      model: "m",
      stopReason: "toolUse",
      timestamp: 1,
    },
  });

  it("lists the calls waiting for approval in order", () => {
    const items = [turn(call("a"), call("b")), turn(call("c"))];
    const tools = {
      a: { status: "done" as const },
      b: { status: "running" as const, approval: {} },
      c: { status: "running" as const, approval: {} },
    };
    expect(waitingCalls(items, tools)).toEqual(["b", "c"]);
    expect(waitingCalls(items, {})).toEqual([]);
  });

  it("lists a script's waiting calls after it, in the order they started", () => {
    const items = [turn(call("s")), turn(call("c"))];
    const tools = {
      s: {
        status: "running" as const,
        nested: [call("s/1"), call("s/2"), call("s/3")],
      },
      "s/1": { status: "done" as const },
      "s/2": { status: "running" as const, approval: {} },
      "s/3": { status: "running" as const, approval: {} },
      c: { status: "running" as const, approval: {} },
    };
    expect(waitingCalls(items, tools)).toEqual(["s/2", "s/3", "c"]);
  });
});

describe("inArrivalOrder", () => {
  it("keeps calls already waiting first and adds new ones after", () => {
    expect(inArrivalOrder(["c"], ["a", "c"])).toEqual(["c", "a"]);
  });

  it("drops answered calls", () => {
    expect(inArrivalOrder(["a", "b"], ["b"])).toEqual(["b"]);
  });
});
