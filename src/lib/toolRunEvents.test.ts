import { describe, expect, it } from "vitest";
import type { SessionEvent } from "../../shared/agentTypes";
import type { ScriptDetails } from "../../shared/codemode";
import {
  applyEvent,
  EMPTY,
  fromHistory,
  type Transcript,
} from "@/lib/transcript";

const run = (events: SessionEvent[], t: Transcript = EMPTY) =>
  events.reduce(applyEvent, t);

const output = { content: [{ type: "text" as const, text: "ok" }] };

const start = (id: string, parent?: string): SessionEvent => ({
  type: "tool_execution_start",
  toolCallId: id,
  toolName: parent ? "read" : "codemode",
  args: parent ? { path: "a.ts" } : { code: "", reason: "Look around" },
  ...(parent && { parentToolCallId: parent }),
});

const end = (id: string, durationMs?: number): SessionEvent => ({
  type: "tool_execution_end",
  toolCallId: id,
  result: output,
  isError: false,
  ...(durationMs !== undefined && { durationMs }),
});

describe("a script's calls", () => {
  it("nest under the script as they start, once each", () => {
    const t = run([
      start("s"),
      start("s/1", "s"),
      start("s/1", "s"),
      start("s/2", "s"),
    ]);
    expect(t.tools.s.nested?.map((c) => c.id)).toEqual(["s/1", "s/2"]);
    expect(t.tools.s.nested?.[0]).toEqual({
      type: "toolCall",
      id: "s/1",
      name: "read",
      arguments: { path: "a.ts" },
    });
    expect(t.tools["s/1"]).toEqual({ status: "running" });
  });

  it("are cut short when the script ends first, and keep its time", () => {
    const t = run([
      start("s"),
      start("s/1", "s"),
      start("s/2", "s"),
      end("s/1"),
      end("s", 1800),
    ]);
    expect(t.tools["s/1"]).toMatchObject({ status: "done" });
    expect(t.tools["s/2"]).toEqual({ status: "error", cancelled: true });
    expect(t.tools.s).toMatchObject({ status: "done", durationMs: 1800 });
  });

  it("come back from a saved script's details", () => {
    const details: ScriptDetails = {
      calls: [
        {
          id: "s/1",
          name: "read",
          arguments: {},
          status: "done",
          result: output,
        },
        { id: "s/2", name: "bash", arguments: {}, status: "error" },
        { id: "s/3", name: "bash", arguments: {}, status: "unfinished" },
        { id: "s/4", name: "bash", arguments: {} },
      ],
      seen: 2,
      durationMs: 900,
    };
    const t = fromHistory(
      [
        {
          role: "toolResult",
          toolCallId: "s",
          toolName: "codemode",
          content: output.content,
          details,
          isError: false,
          timestamp: 0,
        },
      ],
      false,
    );
    expect(t.tools.s).toMatchObject({ status: "done", durationMs: 900 });
    expect(t.tools.s.nested?.map((c) => c.id)).toEqual([
      "s/1",
      "s/2",
      "s/3",
      "s/4",
    ]);
    expect(t.tools["s/1"]).toEqual({ status: "done", result: output });
    expect(t.tools["s/2"]).toEqual({ status: "error" });
    expect(t.tools["s/3"]).toEqual({ status: "error", cancelled: true });
    expect(t.tools["s/4"]).toEqual({ status: "running" });
  });

  it("replayed after their script ended, are cut short unless their own end follows", () => {
    const t = run([
      start("s"),
      end("s"),
      start("s/1", "s"),
      {
        type: "tool_execution_update",
        toolCallId: "s/1",
        partialResult: output,
        parentToolCallId: "s",
      },
      start("s/2", "s"),
      end("s/2"),
    ]);
    expect(t.tools["s/1"]).toEqual({ status: "error", cancelled: true });
    expect(t.tools["s/2"]).toEqual({ status: "done", result: output });
  });

  it("keep an MCP failure the adapter reported in details when reopened", () => {
    const failed = {
      content: output.content,
      details: { error: "server_backoff" },
    };
    const details: ScriptDetails = {
      calls: [
        {
          id: "s/1",
          name: "mcp",
          arguments: {},
          status: "done",
          result: failed,
        },
      ],
      seen: 2,
    };
    const t = fromHistory(
      [
        {
          role: "toolResult",
          toolCallId: "s",
          toolName: "codemode",
          content: output.content,
          details,
          isError: false,
          timestamp: 0,
        },
      ],
      false,
    );
    expect(t.tools["s/1"].status).toBe("error");
  });

  it("leaves other results alone", () => {
    const t = fromHistory(
      [
        {
          role: "toolResult",
          toolCallId: "r",
          toolName: "read",
          content: output.content,
          details: { calls: "not a script" },
          isError: false,
          timestamp: 0,
        },
      ],
      false,
    );
    expect(t.tools.r).toEqual({
      status: "done",
      result: { content: output.content, details: { calls: "not a script" } },
    });
  });
});
