// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { AgentMessage } from "../shared/agentTypes.ts";
import type { Session } from "./hostTypes.ts";
import { procedureRule } from "./procedures.ts";
import {
  CHUNK_CHARS,
  parseWritten,
  runText,
  write,
  writerInput,
} from "./memoryWriter.ts";

const model = {
  provider: "x",
  id: "cheap",
  name: "Cheap",
  cost: { output: 1 },
};

const session = (...replies: unknown[]) => {
  const complete = vi.fn();
  for (const r of replies) complete.mockImplementationOnce(async () => r);
  return {
    model,
    modelRuntime: {
      getModels: () => [model],
      getAvailable: async () => [model],
      completeSimple: complete,
    } as unknown as Session["modelRuntime"],
  };
};

const answer = (json: object, stopReason = "stop") => ({
  content: [{ type: "text", text: `Here:\n${JSON.stringify(json)}` }],
  stopReason,
});

const user = (content: string) =>
  ({ role: "user", content, timestamp: 1 }) as AgentMessage;
const call = (name: string, args: object) =>
  ({
    role: "assistant",
    content: [
      { type: "text", text: "On it" },
      { type: "toolCall", id: name, name, arguments: args },
    ],
    stopReason: "toolUse",
  }) as unknown as AgentMessage;
const result = (toolName: string, text: string) =>
  ({
    role: "toolResult",
    toolCallId: toolName,
    toolName,
    isError: false,
    content: [{ type: "text", text }],
  }) as unknown as AgentMessage;

describe("runText", () => {
  it("leaves out skipped tools, private text and other messages", () => {
    const [text] = runText(
      [
        user("fix the timer <private>my token</private>"),
        call("memory_search", { query: "timer" }),
        result("memory_search", "1 Timer"),
        call("read", { path: "src/timer.ts" }),
        result("read", "const start = 299"),
        { role: "custom", content: "hidden", timestamp: 1 } as AgentMessage,
      ],
      ["memory_search"],
    );
    expect(text).toContain("fix the timer [private]");
    expect(text).not.toContain("my token");
    expect(text).not.toContain("memory_search");
    expect(text).toContain('read(path="src/timer.ts")');
    expect(text).toContain("const start = 299");
    expect(text).not.toContain("hidden");
  });

  it("leaves out private text in replies and results, and images", () => {
    const [text] = runText(
      [
        {
          role: "assistant",
          content: [{ type: "text", text: "I saw <private>a key</private>" }],
        } as unknown as AgentMessage,
        {
          role: "toolResult",
          toolCallId: "r",
          toolName: "read",
          isError: false,
          content: [
            { type: "text", text: "<private>pw</private> done" },
            { type: "image", data: "QUJD", mimeType: "image/png" },
          ],
        } as unknown as AgentMessage,
      ],
      [],
    );
    expect(text).not.toMatch(/a key|pw|QUJD/);
    expect(text).toContain("[private] done");
  });

  it("leaves out a private span that a cut would split", () => {
    const content = `${"x".repeat(1_400)}<private>${"s".repeat(400)}</private>`;
    const [text] = runText([call("write", { path: "a.ts", content })], []);
    expect(text).not.toContain("sss");
    expect(text).toContain("[private]");
  });

  it("cuts long arguments and splits a long run into chunks", () => {
    const big = "x".repeat(CHUNK_CHARS * 0.6);
    const chunks = runText(
      [user(big), call("write", { path: "a.ts", content: big }), user(big)],
      [],
    );
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toContain("…");
    expect(chunks.every((c) => c.length <= CHUNK_CHARS)).toBe(true);
    expect(runText([], [])).toEqual([]);
  });
});

it("tells the writer what's already recorded", () => {
  expect(writerInput("run", ["Fixed the timer"])).toBe(
    "Already recorded in this conversation:\n- Fixed the timer\n\nThe run:\nrun",
  );
  expect(writerInput("run", [])).toContain("(nothing)");
});

describe("parseWritten", () => {
  it("reads observations and the summary, fixing what it can", () => {
    const written = parseWritten(
      JSON.stringify({
        observations: [
          {
            type: "made-up",
            title: " Timer starts at 05:00 ",
            facts: ["start is 300", 4, " "],
            concepts: ["gotcha", "bugfix"],
            files_modified: ["/tree/src/timer.ts"],
          },
          { type: "bugfix" },
          "not an object",
        ],
        summary: { request: "Fix the timer", completed: "Fixed" },
      }),
      (p) => p.replace("/tree/", ""),
    );
    expect(written).toEqual([
      {
        type: "change",
        title: "Timer starts at 05:00",
        subtitle: null,
        facts: ["start is 300"],
        narrative: null,
        concepts: ["gotcha"],
        filesRead: [],
        filesModified: ["src/timer.ts"],
      },
      expect.objectContaining({
        type: "summary",
        title: "Fix the timer",
        narrative: "Completed: Fixed",
      }),
    ]);
  });

  it("keeps the procedure concept only when the run may teach procedures", () => {
    const reply = JSON.stringify({
      observations: [
        { type: "discovery", title: "Running tests", concepts: ["procedure"] },
      ],
    });
    expect(parseWritten(reply)[0].concepts).toEqual([]);
    expect(parseWritten(reply, undefined, true)[0].concepts).toEqual([
      "procedure",
    ]);
  });

  it("takes nothing from a reply that isn't the JSON asked for", () => {
    expect(parseWritten("Nothing to record.")).toEqual([]);
    expect(parseWritten("[1, 2]")).toEqual([]);
    expect(parseWritten('{"observations": "none", "summary": null}')).toEqual(
      [],
    );
  });
});

describe("write", () => {
  const run = [
    user("fix the timer"),
    call("read", { path: "a.ts" }),
    result("read", "ok"),
  ];

  it("asks the cheapest model, with what's recorded", async () => {
    const s = session(
      answer({
        observations: [{ type: "bugfix", title: "Fixed" }],
        summary: null,
      }),
    );
    const written = await write(s, run, ["Earlier"], (p) => p, []);
    expect(written.map((m) => m.title)).toEqual(["Fixed"]);
    const [used, context, options] = vi.mocked(s.modelRuntime.completeSimple)
      .mock.calls[0];
    expect(used).toBe(model);
    expect(context.messages[0].content).toContain("- Earlier");
    expect(options).toMatchObject({ cacheRetention: "none" });
    expect(context.systemPrompt).not.toContain(procedureRule([]));
  });

  it("asks for procedures with their rule when the run may teach them", async () => {
    const s = session(answer({ observations: [] }));
    await write(s, run, [], (p) => p, [], {
      procedures: procedureRule(["Running the tests"]),
    });
    const [, context] = vi.mocked(s.modelRuntime.completeSimple).mock.calls[0];
    expect(context.systemPrompt).toContain(
      procedureRule(["Running the tests"]),
    );
  });

  it("writes a long run a chunk at a time, keeping the last summary", async () => {
    const big = "x".repeat(CHUNK_CHARS * 0.6);
    const s = session(
      answer({
        observations: [{ title: "First" }],
        summary: { request: "Early gist" },
      }),
      answer({}, "error"),
      answer({
        observations: [{ title: "Last" }],
        summary: { request: "Whole gist" },
      }),
    );
    const written = await write(
      s,
      [user(big), user(big), user(big)],
      [],
      (p) => p,
      [],
    );
    expect(written.map((m) => m.title)).toEqual([
      "First",
      "Last",
      "Whole gist",
    ]);
    const third = vi.mocked(s.modelRuntime.completeSimple).mock.calls[2][1];
    expect(third.messages[0].content).toContain("- First");
  });

  it("reads a long run whole when it fits the model's window", async () => {
    const big = "x".repeat(CHUNK_CHARS * 0.6);
    const s = session(answer({ observations: [{ title: "Whole" }] }));
    const wide = { ...model, contextWindow: 200_000 };
    Object.assign(s, { model: wide });
    Object.assign(s.modelRuntime, {
      getModels: () => [wide],
      getAvailable: async () => [wide],
    });
    await write(s, [user(big), user(big), user(big)], [], (p) => p, []);
    expect(s.modelRuntime.completeSimple).toHaveBeenCalledOnce();
  });

  it("writes nothing, saying why, when the model fails or no model has a price", async () => {
    const failed = vi.fn();
    const failing = session();
    vi.mocked(failing.modelRuntime.completeSimple).mockRejectedValue(
      new Error("down"),
    );
    expect(await write(failing, run, [], (p) => p, [], { failed })).toEqual([]);
    expect(failed).toHaveBeenLastCalledWith("Error: down");
    const refused = session();
    vi.mocked(refused.modelRuntime.completeSimple).mockResolvedValue({
      stopReason: "error",
      errorMessage: "credit balance is too low",
      content: [],
    } as never);
    expect(await write(refused, run, [], (p) => p, [], { failed })).toEqual([]);
    expect(failed).toHaveBeenLastCalledWith("error: credit balance is too low");
    // A timeout (aborted) or a reply cut off counts too: what came back can't be used.
    const cut = session();
    vi.mocked(cut.modelRuntime.completeSimple).mockResolvedValue({
      stopReason: "length",
      content: [{ type: "text", text: '{"observations": [' }],
    } as never);
    expect(await write(cut, run, [], (p) => p, [], { failed })).toEqual([]);
    expect(failed).toHaveBeenLastCalledWith("length");
    const unpriced = { ...session(), model: { ...model, cost: undefined } };
    const s = {
      ...unpriced,
      modelRuntime: {
        ...unpriced.modelRuntime,
        getModels: () => [unpriced.model],
      },
    };
    expect(await write(s as never, run, [], (p) => p, [], { failed })).toEqual(
      [],
    );
    expect(s.modelRuntime.completeSimple).not.toHaveBeenCalled();
    expect(failed).toHaveBeenLastCalledWith(
      expect.stringMatching(/^no priced model/),
    );
  });
});
