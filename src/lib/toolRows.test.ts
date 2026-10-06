import { describe, expect, it } from "vitest";
import type { AssistantMessage, ToolCall } from "../../shared/agentTypes";
import {
  inArrivalOrder,
  waitingCalls,
  diffSummary,
  groupSummary,
  isShortOutput,
  outputPreview,
  parseDiff,
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
  it("folds quiet tool calls across messages into one group", () => {
    const rows = toRows([
      assistant([call("read", "a")]),
      {
        kind: "message",
        message: {
          role: "toolResult",
          toolCallId: "a",
          toolName: "read",
          content: [],
          isError: false,
          timestamp: 0,
        },
      },
      assistant([call("bash", "b"), call("grep", "c")]),
    ]);
    expect(rows).toEqual([
      {
        kind: "group",
        calls: [call("read", "a"), call("bash", "b"), call("grep", "c")],
      },
    ]);
  });

  it("keeps edits, writes and other tools on their own rows, splitting groups", () => {
    const rows = toRows([
      assistant([
        call("read", "a"),
        call("grep", "b"),
        call("edit"),
        call("read", "c"),
        call("ls", "d"),
      ]),
    ]);
    expect(rows.map((r) => r.kind)).toEqual(["group", "tool", "group"]);
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
      false,
      { a: plan("done"), b: plan("done"), c: plan("done"), e: plan("done") },
    );
    expect(rows).toEqual([
      { kind: "tool", call: call("task_update", "c") },
      { kind: "tool", call: call("task_update", "d") },
      { kind: "tool", call: call("task_update", "e") },
      { kind: "tool", call: call("read") },
    ]);
  });

  it("takes a failed call out of its group, so the group holds only calls that worked", () => {
    const rows = toRows(
      [
        assistant([
          call("read", "a"),
          call("bash", "b"),
          call("grep", "c"),
          call("read", "d"),
          call("ls", "e"),
        ]),
      ],
      false,
      { a: { status: "done" }, b: { status: "done" }, c: { status: "error" } },
    );
    expect(rows).toEqual([
      { kind: "group", calls: [call("read", "a"), call("bash", "b")] },
      { kind: "tool", call: call("grep", "c") },
      { kind: "group", calls: [call("read", "d"), call("ls", "e")] },
    ]);
  });

  it("takes a command that changed files out of its group, so its edits show", () => {
    const edits = [{ path: "a.ts", diff: "" }];
    const rows = toRows(
      [assistant([call("read", "a"), call("bash", "b")])],
      false,
      {
        b: { status: "done", result: { content: [], details: { edits } } },
      },
    );
    expect(rows).toEqual([
      { kind: "tool", call: call("read", "a") },
      { kind: "tool", call: call("bash", "b") },
    ]);
  });

  it("text breaks a group", () => {
    const rows = toRows([
      assistant([
        call("read", "a"),
        call("read", "b"),
        { type: "text", text: "hm" },
        call("read", "c"),
        call("read", "d"),
      ]),
    ]);
    expect(rows.map((r) => r.kind)).toEqual(["group", "text", "group"]);
  });

  it("shows a lone quiet call as its own row instead of a group of one", () => {
    const rows = toRows([
      assistant([
        call("edit"),
        call("bash", "b"),
        { type: "text", text: "ok" },
      ]),
    ]);
    expect(rows).toEqual([
      { kind: "tool", call: call("edit") },
      { kind: "tool", call: call("bash", "b") },
      { kind: "text", text: "ok" },
    ]);
  });

  it("hides thinking unless asked to show it", () => {
    const rows = toRows([
      assistant([{ type: "thinking", thinking: "why" }], "stop"),
    ]);
    expect(rows).toEqual([]);
  });

  it("skips empty text and redacted empty thinking, keeps other thinking", () => {
    const rows = toRows(
      [
        assistant(
          [
            { type: "text", text: "" },
            { type: "thinking", thinking: "", redacted: true },
            { type: "thinking", thinking: "why" },
          ],
          "stop",
        ),
      ],
      true,
    );
    expect(rows).toEqual([{ kind: "thinking", thinking: "why" }]);
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
});

describe("groupSummary", () => {
  it("counts each kind, singular and plural", () => {
    expect(
      groupSummary([
        call("read"),
        call("read"),
        call("grep"),
        call("find"),
        call("ls"),
        call("bash"),
      ]),
    ).toBe(
      "Read 2 files, searched for 2 patterns, listed 1 folder, ran 1 shell command",
    );
  });

  it("leaves out kinds that didn't run", () => {
    expect(groupSummary([call("bash"), call("bash")])).toBe(
      "Ran 2 shell commands",
    );
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
});

describe("inArrivalOrder", () => {
  it("keeps calls already waiting first and adds new ones after", () => {
    expect(inArrivalOrder(["c"], ["a", "c"])).toEqual(["c", "a"]);
  });

  it("drops answered calls", () => {
    expect(inArrivalOrder(["a", "b"], ["b"])).toEqual(["b"]);
  });
});
