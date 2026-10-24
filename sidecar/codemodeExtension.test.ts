import { describe, expect, it, vi } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import codemodeExtension, { keptResult } from "./codemodeExtension.ts";

const factory = vi.hoisted(() => vi.fn());

vi.mock("@earendil-works/pi-coding-agent", () => ({
  createCodemodeExtension: (options: unknown) => {
    factory(options);
    return (pi: ExtensionAPI) =>
      pi.registerTool({
        name: "codemode",
        description: "Run JavaScript.",
        parameters: {
          type: "object",
          properties: { code: {} },
          required: ["code"],
        },
        execute: () => ({ content: [] }),
      } as unknown as Parameters<ExtensionAPI["registerTool"]>[0]);
  },
}));

type Handler = (event: Record<string, unknown>) => unknown;

function load() {
  const handlers: Record<string, Handler[]> = {};
  const tools: {
    description: string;
    parameters: { required: string[] };
  }[] = [];
  const pi = {
    on: (name: string, handler: Handler) =>
      (handlers[name] ??= []).push(handler),
    registerTool: (tool: (typeof tools)[number]) => tools.push(tool),
  } as unknown as ExtensionAPI;
  codemodeExtension(pi);
  const emit = (name: string, event: Record<string, unknown>) =>
    handlers[name].map((h) => h(event)).find((r) => r !== undefined);
  return { emit, tools };
}

const text = (t: string) => [{ type: "text" as const, text: t }];
const SCRIPT = { code: "// Look around\nreturn 1;" };

describe("codemodeExtension", () => {
  it("asks for a first comment line in the description, keeping code the only input, and no models", () => {
    const { tools } = load();
    expect(tools[0].parameters.required).toEqual(["code"]);
    expect(tools[0].description).toContain("`// <why>` comment line");
    expect(factory).toHaveBeenCalledWith({ models: false });
  });

  it("refuses a script without its why, and ask_user from a script", () => {
    const { emit } = load();
    const call = (input: unknown, extra = {}) =>
      emit("tool_call", {
        toolName: "codemode",
        toolCallId: "s",
        input,
        ...extra,
      });
    expect(call({ code: "return 1;" })).toMatchObject({ block: true });
    expect(call(SCRIPT)).toBeUndefined();
    expect(
      emit("tool_call", {
        toolName: "ask_user",
        toolCallId: "s/1",
        parentToolCallId: "s",
        input: {},
      }),
    ).toMatchObject({ block: true });
    expect(
      emit("tool_call", { toolName: "ask_user", toolCallId: "a", input: {} }),
    ).toBeUndefined();
  });

  it("keeps each call the script made on its result, with its arguments as the agent wrote them", () => {
    const { emit } = load();
    emit("tool_call", { toolName: "codemode", toolCallId: "s", input: SCRIPT });
    const args = { command: "npm test" };
    const start = (id: string, name: string, a: unknown) =>
      emit("tool_execution_start", {
        toolCallId: id,
        toolName: name,
        args: a,
        parentToolCallId: "s",
      });
    start("s/1", "read", { path: "a.ts" });
    start("s/2", "bash", args);
    start("s/3", "bash", {});
    // The sandbox rewrites the command after the call started.
    args.command = "sandbox-exec … npm test";
    emit("tool_execution_start", { toolCallId: "s", toolName: "codemode" });
    emit("tool_result", {
      toolCallId: "s/1",
      parentToolCallId: "s",
      content: text("hello"),
      details: { lines: 1 },
      isError: false,
    });
    emit("tool_result", {
      toolCallId: "s/2",
      parentToolCallId: "s",
      content: text("boom"),
      isError: true,
    });
    // A call from a script this extension never saw starting.
    emit("tool_result", {
      toolCallId: "z/1",
      parentToolCallId: "z",
      content: text("?"),
      isError: false,
    });

    const result = emit("tool_result", {
      toolCallId: "s",
      toolName: "codemode",
      content: text("done"),
      details: { own: 1 },
      isError: false,
    }) as { details: Record<string, unknown> };
    expect(result.details).toMatchObject({
      own: 1,
      seen: 9,
      calls: [
        {
          id: "s/1",
          name: "read",
          arguments: { path: "a.ts" },
          status: "done",
          result: { content: text("hello"), details: { lines: 1 } },
        },
        {
          id: "s/2",
          name: "bash",
          arguments: { command: "npm test" },
          status: "error",
          result: { content: text("boom") },
        },
        { id: "s/3", name: "bash", status: "unfinished" },
      ],
    });
    expect(result.details.durationMs).toBeGreaterThanOrEqual(0);
    // Forgotten once recorded, and other tools' results are left alone.
    expect(
      emit("tool_result", {
        toolCallId: "s",
        toolName: "codemode",
        content: [],
        isError: false,
      }),
    ).toBeUndefined();
    expect(
      emit("tool_result", {
        toolCallId: "r",
        toolName: "read",
        content: [],
        isError: false,
      }),
    ).toBeUndefined();
  });

  it("keeps only the names of calls past the record's room", () => {
    const { emit } = load();
    emit("tool_call", { toolName: "codemode", toolCallId: "s", input: SCRIPT });
    const big = "x".repeat(4_000);
    for (let i = 0; i < 300; i++) {
      emit("tool_execution_start", {
        toolCallId: `s/${i}`,
        toolName: "write",
        args: { content: big },
        parentToolCallId: "s",
      });
      emit("tool_result", {
        toolCallId: `s/${i}`,
        parentToolCallId: "s",
        content: text(big),
        isError: false,
      });
    }
    const { details } = emit("tool_result", {
      toolCallId: "s",
      toolName: "codemode",
      content: [],
      isError: false,
    }) as { details: { calls: { arguments: object; status: string }[] } };
    expect(JSON.stringify(details).length).toBeLessThan(1_100_000);
    expect(details.calls).toHaveLength(300);
    expect(details.calls.at(-1)).toEqual({
      id: "s/299",
      name: "write",
      arguments: {},
      status: "done",
    });
  });
});

describe("keptResult", () => {
  it("cuts long text, drops images, and keeps details only while they're small", () => {
    const long = "x".repeat(5_000);
    const kept = keptResult(
      [...text(long), { type: "image", data: "", mimeType: "image/png" }],
      { big: "y".repeat(60_000) },
    );
    expect(kept.details).toBeUndefined();
    expect(kept.content).toEqual(text(`${"x".repeat(4_000)}…`));
    expect(keptResult(text("a"), { diff: "d" })).toEqual({
      content: text("a"),
      details: { diff: "d" },
    });
    expect(keptResult(text("a"), undefined)).toEqual({ content: text("a") });
  });
});
