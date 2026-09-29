import { describe, expect, it } from "vitest";
import type {
  AssistantMessage,
  ToolCall,
  ToolResultMessage,
} from "../../shared/agentTypes";
import { ASK_TOOL } from "../../shared/questions";
import { DEMO_STATE, shownRows, shownSession } from "./demo";
import { DEMO_QUESTION_MESSAGES, DEMO_QUESTIONS } from "./demoQuestions";
import { readQuestions } from "./questions";
import { DEMO_DIFFS, DEMO_MESSAGES } from "./demoTranscript";
import { EMPTY, fromHistory } from "./transcript";
import { parseDiff, toRows } from "./toolRows";

const FILES = import.meta.glob("../../demo/tempo/**/*", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const file = (path: string) => FILES[`../../demo/tempo/${path}`];
const PANTRY = import.meta.glob("../../demo/pantry/**/*", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const session = {
  session: null,
  state: null,
  transcript: EMPTY,
  trust: null,
  error: null,
  send: () => {},
};

describe("shownSession", () => {
  it("passes the session through outside demo mode, with the host's error", () => {
    expect(shownSession(session, "The agent host failed", null, null)).toEqual({
      ...session,
      error: "The agent host failed",
    });
    const failed = { ...session, error: "No model" };
    expect(
      shownSession(failed, "The agent host failed", null, null).error,
    ).toBe("No model");
  });

  it("shows the demo conversation in demo mode", () => {
    const shown = shownSession(
      session,
      "ignored",
      "/repo/demo/tempo",
      "/repo/demo/tempo",
    );
    expect(shown.state).toBe(DEMO_STATE);
    expect(shown.trust).toBe("trusted");
    expect(shown.error).toBeNull();
    expect(shown.session).toBe("tempo");
    expect(shown.transcript!.items.length).toBe(DEMO_MESSAGES.length);
    expect(shown.send).toBe(session.send);
  });

  it("shows pantry's conversation, waiting on its questions", () => {
    const shown = shownSession(
      session,
      null,
      "/repo/demo/pantry",
      "/repo/demo/tempo",
    );
    expect(shown.transcript!.items.length).toBe(DEMO_QUESTION_MESSAGES.length);
    expect(shown.transcript!.running).toBe(true);
    expect(shown.transcript!.tools[DEMO_QUESTIONS.id]).toEqual({
      status: "running",
      approval: {},
    });
  });
});

describe("shownRows", () => {
  it("passes a folder's conversations through outside demo mode", () => {
    const rows = () => [];
    expect(shownRows(rows, null)).toBe(rows);
  });

  it("shows tempo with a second conversation working, and pantry waiting", () => {
    const rows = shownRows(() => [], "/repo/demo/tempo");
    expect(rows("/repo/demo/tempo").map((a) => [a.session, a.running])).toEqual(
      [
        ["tempo", false],
        ["tempo-tests", true],
      ],
    );
    expect(rows("/repo/demo/pantry")).toMatchObject([
      { session: "pantry", waiting: true },
    ]);
  });
});

describe("the pantry conversation", () => {
  it("asks well-formed questions, recommending one option each", () => {
    expect(DEMO_QUESTIONS.name).toBe(ASK_TOOL);
    const questions = readQuestions(DEMO_QUESTIONS.arguments);
    expect(questions).toHaveLength(3);
    for (const q of questions) {
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(q.options.length).toBeLessThanOrEqual(4);
    }
    const recommended = questions.filter((q) =>
      q.options[0].label.endsWith("(Recommended)"),
    );
    expect(recommended).toHaveLength(2);
  });

  it("reads files as they start in demo/pantry", () => {
    const reads = DEMO_QUESTION_MESSAGES.filter(
      (m): m is ToolResultMessage => m.role === "toolResult",
    );
    expect(reads).toHaveLength(2);
    for (const read of reads) {
      const path =
        read.toolCallId === "p1" ? "src/server.ts" : "src/recipes.ts";
      const text = (read.content[0] as { text: string }).text.replace(/…$/, "");
      expect(PANTRY[`../../demo/pantry/${path}`].startsWith(text)).toBe(true);
    }
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
