import { describe, expect, it } from "vitest";
import type { AssistantMessage, ToolCall } from "../../shared/agentTypes";
import { diffSummary, groupSummary, parseDiff, toRows } from "./toolRows";
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
