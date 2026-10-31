// @vitest-environment node
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

// An agent dir that doesn't exist yet, as on a first launch.
vi.stubEnv(
  "PI_CODING_AGENT_DIR",
  join(realpathSync(mkdtempSync(join(tmpdir(), "bridge-"))), "agent"),
);

const bridge = vi.hoisted(() => ({
  seam: { setQuery: vi.fn() } as
    { setQuery: ReturnType<typeof vi.fn> } | undefined,
  cwdWhileLoading: "",
}));
vi.mock("pi-claude-bridge/src/index.ts", () => ({
  default: vi.fn(() => {
    bridge.cwdWhileLoading = process.cwd();
  }),
  get __test() {
    return bridge.seam;
  },
}));
const query = vi.hoisted(() => vi.fn());
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({ query }));

const {
  default: claudeBridge,
  captureReplayedPrompt,
  guarded,
  retryUncaptured,
} = await import("./claudeBridgeExtension.ts");

describe("guarded", () => {
  it("runs Claude Code on user settings only, with no hooks and its own executable", () => {
    expect(
      guarded({
        cwd: "/wt/a",
        settings: { includeGitInstructions: false },
        pathToClaudeCodeExecutable: "/wt/a/evil.sh",
      }),
    ).toEqual({
      cwd: "/wt/a",
      settingSources: ["user"],
      settings: { includeGitInstructions: false, disableAllHooks: true },
    });
    expect(
      guarded({ settingSources: ["user", "project"] }).settingSources,
    ).toEqual(["user"]);
    expect(guarded({ settingSources: [] }).settingSources).toEqual([]);
    expect(guarded().settings).toEqual({ disableAllHooks: true });
  });
});

describe("claudeBridge", () => {
  it("guards every query, and loads the bridge away from the worktree", () => {
    const at = process.cwd();
    claudeBridge({ on: vi.fn() } as never);
    expect(bridge.cwdWhileLoading).toBe(getAgentDir());
    expect(process.cwd()).toBe(at);
    const wrapped = bridge.seam!.setQuery.mock.calls[0][0];
    wrapped({ prompt: "hi", options: { pathToClaudeCodeExecutable: "/x" } });
    expect(query).toHaveBeenCalledWith({
      prompt: "hi",
      options: {
        settingSources: ["user"],
        settings: { disableAllHooks: true },
      },
    });
  });

  it("refuses to load a bridge it can't guard", () => {
    bridge.seam = undefined;
    expect(() => claudeBridge({} as never)).toThrow(/guard/);
  });
});

describe("retryUncaptured", () => {
  const user = (id: string) => ({
    id,
    type: "message",
    message: { role: "user" },
  });
  const failed = (errorMessage: string) => ({
    id: "a",
    type: "message",
    message: { role: "assistant", errorMessage },
  });
  const settle = () => {
    let handler: (event: object, ctx: object) => unknown = () => {};
    retryUncaptured({
      on: (_name: string, h: typeof handler) => (handler = h),
    } as never);
    return (branch: object[], outcome = "error", entries: object[] = []) =>
      handler(
        { outcome, entries },
        { sessionManager: { getBranch: () => branch } },
      );
  };
  const uncaptured = "prompt-capture: no capture for this 43203-char prompt";

  it("runs a turn refused for want of its prompt once more, without the failed reply, keeping others' entries", () => {
    const run = settle();
    const branch = [user("u1"), failed(uncaptured)];
    const earlier = { type: "custom", customType: "x", data: 1 };
    expect(run(branch, "error", [earlier])).toEqual({
      continue: true,
      entries: [
        earlier,
        { type: "context_edit", targetId: "a", replacement: null },
      ],
    });
    // Once per message that started the run: failing again, it settles.
    expect(run(branch)).toBeUndefined();
    expect(run([user("u2"), failed(uncaptured)])).toMatchObject({
      continue: true,
    });
    const woken = { id: "w1", type: "custom_message" };
    expect(run([user("u2"), woken, failed(uncaptured)])).toMatchObject({
      continue: true,
    });
  });

  it("leaves other errors, refusals another try won't fix, and finished runs alone", () => {
    const run = settle();
    expect(run([user("u1"), failed("Request timed out.")])).toBeUndefined();
    expect(
      run([user("u1"), failed("prompt-capture: refusing to send this prompt")]),
    ).toBeUndefined();
    expect(run([user("u1"), failed(uncaptured)], "done")).toBeUndefined();
    expect(run([user("u1")])).toBeUndefined();
  });
});

const { sharedPromptCaptures } = await vi.importActual<{
  sharedPromptCaptures(): {
    record(prompt: string, input: object, source?: string): void;
    resolveOrDerive(prompt: string): { sections?: object } | undefined;
  };
}>("pi-claude-bridge/src/prompt-capture.ts");

describe("captureReplayedPrompt", () => {
  const captures = sharedPromptCaptures();
  const block = (name: string, text: string) =>
    `<${name}>\n${text}\n</${name}>`;
  const system = (sections: Record<string, string | null>) => ({
    role: "system",
    content: "",
    sections,
    timestamp: 0,
  });
  const contextWith = (fresh: string, messages: object[]) => {
    let handler: (event: object, ctx: object) => unknown = () => {};
    captureReplayedPrompt({
      on: (_name: string, h: typeof handler) => (handler = h),
    } as never);
    handler({ messages }, { getSystemPrompt: () => fresh });
  };
  const sections = { questions: "Ask.", copyable: "Fence.", replies: "Short." };

  it("lets the bridge resolve a section added since the conversation began, replayed last", () => {
    const fresh = Object.entries({ ...sections, subagents: "Hand off." })
      .map(([name, text]) => block(name, text))
      .join("\n\n");
    captures.record(
      fresh,
      { contextFiles: [], skills: [], sections },
      "turn_start",
    );
    const began = system({
      questions: block("questions", "Ask."),
      copyable: block("copyable", "Fence."),
      subagents: block("subagents", "Hand off."),
    });
    const added = system({ replies: block("replies", "Short.") });
    const sent = [began, added]
      .map((m) => Object.values(m.sections).join("\n\n"))
      .join("\n\n");
    expect(() => captures.resolveOrDerive(sent)).toThrow(/no capture/);
    contextWith(fresh, [began, { role: "user" }, added]);
    expect(captures.resolveOrDerive(sent)?.sections).toEqual(sections);
  });

  it("leaves a prompt whose sections differ, not just their order, unresolved", () => {
    const fresh = block("questions", "Ask.");
    captures.record(fresh, { contextFiles: [], skills: [] }, "turn_start");
    const sent = system({ questions: block("questions", "Ask!") });
    contextWith(fresh, [sent]);
    expect(() => captures.resolveOrDerive(block("questions", "Ask!"))).toThrow(
      /no capture/,
    );
  });
});

it("the installed bridge still has the seams the guard and idle compaction need", async () => {
  const real = await vi.importActual<{
    __test?: { setQuery?: unknown; getSharedSession?: unknown };
  }>("pi-claude-bridge/src/index.ts");
  expect(typeof real.__test?.setQuery).toBe("function");
  expect(typeof real.__test?.getSharedSession).toBe("function");
});
