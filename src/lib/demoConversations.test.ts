import { describe, expect, it } from "vitest";
import type {
  AssistantMessage,
  ToolCall,
  ToolResultMessage,
} from "../../shared/agentTypes";
import { ASK_TOOL } from "../../shared/questions";
import { demoConversations, DEMO_GIT_DIFFS } from "./demoConversations";
import { DEMO_QUESTION_MESSAGES, DEMO_QUESTIONS } from "./demoQuestions";
import { DEMO_DIFFS } from "./demoTranscript";
import { parseUnifiedDiff } from "./gitDiff";
import { readQuestions } from "./questions";
import { parseDiff, toRows } from "./toolRows";
import { fromHistory, requestApproval } from "./transcript";

const FILES = import.meta.glob("../../demo/*/**/*", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const tempoFile = (path: string) => FILES[`../../demo/tempo/${path}`];

const TEMPO = "/repo/demo/tempo";
const all = demoConversations(TEMPO);
const conversation = (id: string) => all.find((c) => c.id === id)!;
const callsOf = (id: string) =>
  conversation(id).messages.flatMap((m) =>
    m.role === "assistant"
      ? (m as AssistantMessage).content.filter(
          (c): c is ToolCall => c.type === "toolCall",
        )
      : [],
  );
const shown = (id: string) => {
  const c = conversation(id);
  return (c.approvals ?? []).reduce(
    requestApproval,
    fromHistory(c.messages, !!c.running),
  );
};

describe("the dark mode conversation", () => {
  const transcript = shown("tempo");

  it("reads at a glance: the work, its delivery through git, and a summary", () => {
    const rows = toRows(transcript.items);
    expect(rows.at(0)?.kind).toBe("user");
    expect(rows.at(-1)?.kind).toBe("text");
    const git = rows.filter(
      (r) => r.kind === "tool" && ["git", "gh"].includes(r.call.name),
    );
    expect(git).toHaveLength(5);
  });

  it("has every tool call finished, with the commit, push and PR reviewed", () => {
    for (const call of callsOf("tempo")) {
      expect(transcript.tools[call.id]?.status).toBe("done");
    }
    const reviews = callsOf("tempo").flatMap((c) => {
      const details = transcript.tools[c.id]?.result?.details;
      const kind = (details as { kind?: string } | undefined)?.kind;
      return kind ? [kind] : [];
    });
    expect(reviews).toEqual(["commit", "push", "pr"]);
    expect(transcript.running).toBe(false);
  });

  it("writes the theme file exactly as it is in demo/tempo", () => {
    const write = callsOf("tempo").find((c) => c.name === "write")!;
    expect(write.arguments.content).toBe(tempoFile("src/theme.ts"));
  });

  it.each(Object.entries(DEMO_DIFFS))(
    "edits demo/tempo/%s line for line",
    (path, diff) => {
      const lines = tempoFile(path).split("\n");
      for (const line of parseDiff(diff)) {
        // Removed lines are numbered in the old file, which is gone.
        if (line.kind === "gap" || line.kind === "del") continue;
        expect(lines[line.num - 1]).toBe(line.text);
      }
    },
  );
});

describe("the demo's git diffs", () => {
  it.each(Object.entries(DEMO_GIT_DIFFS))(
    "show demo/tempo/%s line for line",
    (path, diff) => {
      const lines = tempoFile(path).split("\n");
      const parsed = parseUnifiedDiff(diff);
      expect(parsed.length).toBeGreaterThan(0);
      for (const line of parsed) {
        if (line.kind === "gap" || line.kind === "del") continue;
        expect(lines[line.num - 1]).toBe(line.text);
      }
    },
  );

  it("counts old line numbers across a file's hunks", () => {
    const styles = parseUnifiedDiff(DEMO_GIT_DIFFS["src/styles.css"]);
    const removed = styles.filter((l) => l.kind === "del");
    expect(removed.map((l) => l.kind === "del" && l.num)).toEqual([4, 5, 14]);
  });
});

describe("tempo's other conversations", () => {
  it("waits on the tests' pull request, showing what it adds", () => {
    const tests = shown("tempo-tests");
    const [pr] = callsOf("tempo-tests").slice(-1);
    const run = tests.tools[pr.id];
    expect(run?.status).toBe("running");
    expect(run?.approval?.review?.kind).toBe("pr");
    expect(run?.approval?.review?.files).toEqual([
      {
        path: "tests/settings.test.ts",
        status: "A",
        added: tempoFile("tests/settings.test.ts").trimEnd().split("\n").length,
        removed: 0,
      },
    ]);
  });

  it("is still working on the reload fix", () => {
    const c = conversation("tempo-reload");
    expect(c.running).toBe(true);
    expect(c.working).toBe(callsOf("tempo-reload").at(-1));
    expect(shown("tempo-reload").tools[c.working!.id]).toBeUndefined();
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
      expect(FILES[`../../demo/pantry/${path}`].startsWith(text)).toBe(true);
    }
  });

  it("waits on its questions", () => {
    const pantry = shown("pantry");
    expect(pantry.running).toBe(true);
    expect(pantry.tools[DEMO_QUESTIONS.id]).toEqual({
      status: "running",
      approval: {},
    });
  });
});
