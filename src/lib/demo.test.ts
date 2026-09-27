import { describe, expect, it } from "vitest";
import type { AssistantMessage, ToolCall } from "../../shared/agentTypes";
import { DEMO_STATE, shownSession } from "./demo";
import { DEMO_DIFFS, DEMO_MESSAGES } from "./demoTranscript";
import { EMPTY, fromHistory } from "./transcript";
import { parseDiff, toRows } from "./toolRows";

const FILES = import.meta.glob("../../demo/tempo/**/*", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const file = (path: string) => FILES[`../../demo/tempo/${path}`];

const session = {
  state: null,
  transcript: EMPTY,
  trust: null,
  error: null,
  send: () => {},
};

describe("shownSession", () => {
  it("passes the session through outside demo mode, with the host's error", () => {
    expect(shownSession(session, "The agent host failed", null)).toEqual({
      ...session,
      error: "The agent host failed",
    });
    const failed = { ...session, error: "No model" };
    expect(shownSession(failed, "The agent host failed", null).error).toBe(
      "No model",
    );
  });

  it("shows the demo conversation in demo mode", () => {
    const shown = shownSession(session, "ignored", "/repo/demo/tempo");
    expect(shown.state).toBe(DEMO_STATE);
    expect(shown.trust).toBe("trusted");
    expect(shown.error).toBeNull();
    expect(shown.transcript.items.length).toBe(DEMO_MESSAGES.length);
    expect(shown.send).toBe(session.send);
  });
});

describe("the demo conversation", () => {
  const transcript = fromHistory(DEMO_MESSAGES, false);
  const calls = DEMO_MESSAGES.flatMap((m) =>
    m.role === "assistant"
      ? (m as AssistantMessage).content.filter(
          (c): c is ToolCall => c.type === "toolCall",
        )
      : [],
  );

  it("reads at a glance: a request, a few steps, and a summary", () => {
    expect(toRows(transcript.items).map((r) => r.kind)).toEqual([
      "user",
      "text",
      "group",
      "text",
      "tool",
      "tool",
      "tool",
      "tool",
      "tool",
      "text",
    ]);
    const shell = toRows(transcript.items).at(-2);
    expect(shell).toMatchObject({ kind: "tool", call: { name: "bash" } });
  });

  it("has every tool call finished", () => {
    for (const call of calls) {
      expect(transcript.tools[call.id]?.status).toBe("done");
    }
    expect(transcript.running).toBe(false);
  });

  it("shows the model the composer shows", () => {
    expect(DEMO_STATE.models).toContain(DEMO_STATE.model);
    expect(DEMO_STATE.thinkingLevels).toContain(DEMO_STATE.thinkingLevel);
  });

  it("writes the theme file exactly as it is in demo/tempo", () => {
    const write = calls.find((c) => c.name === "write")!;
    expect(write.arguments.content).toBe(file("src/theme.ts"));
  });

  it.each(Object.entries(DEMO_DIFFS))(
    "matches demo/tempo/%s line for line",
    (path, diff) => {
      const lines = file(path).split("\n");
      for (const line of parseDiff(diff)) {
        // Removed lines are numbered in the old file, which is gone.
        if (line.kind === "gap" || line.kind === "del") continue;
        expect(lines[line.num - 1]).toBe(line.text);
      }
    },
  );

  it("shows removed lines as well as added ones", () => {
    const kinds = Object.values(DEMO_DIFFS).flatMap((d) =>
      parseDiff(d).map((l) => l.kind),
    );
    expect(kinds).toContain("del");
    expect(kinds).toContain("add");
  });
});
