import { beforeEach, describe, expect, it, vi } from "vitest";

const messages: unknown[] = [];
const query = vi.fn<(options: unknown) => AsyncGenerator<unknown>>(() =>
  (async function* () {
    yield* messages;
  })(),
);
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({ query }));

// A run that yields nothing until it's aborted.
const untilAborted = (options: unknown) =>
  (async function* () {
    const { signal } = (
      options as { options: { abortController: AbortController } }
    ).options.abortController;
    await new Promise((done) => signal.addEventListener("abort", done));
    yield* [];
  })();

const {
  searchWeb,
  claudeSignedIn,
  default: webSearch,
} = await import("./webSearchExtension.ts");

const claudeCode = (loggedIn: boolean | Error) => ({
  status: vi.fn(() =>
    loggedIn instanceof Error
      ? Promise.reject(loggedIn)
      : Promise.resolve({ installed: true, loggedIn }),
  ),
  login: vi.fn(),
});

const LOGIN_KEY = Symbol.for("ignite:webSearchLogin");
const clearLogin = () =>
  delete (globalThis as Record<symbol, unknown>)[LOGIN_KEY];

beforeEach(() => {
  clearLogin();
  messages.length = 0;
  query.mockClear();
});

describe("searchWeb", () => {
  it("returns the final reply, run with only WebSearch", async () => {
    messages.push(
      { type: "assistant", message: { content: [] } },
      { type: "result", subtype: "success", is_error: false, result: "found" },
    );
    expect(await searchWeb("react 19")).toBe("found");
    expect(query.mock.calls[0][0]).toMatchObject({
      prompt: "react 19",
      options: { tools: ["WebSearch"], settingSources: [] },
    });
  });

  it("throws a failed run's errors", async () => {
    messages.push({
      type: "result",
      subtype: "error_during_execution",
      is_error: true,
      errors: ["Not logged in"],
    });
    await expect(searchWeb("x")).rejects.toThrow(
      "Web search failed: Not logged in",
    );
  });

  it("throws a success that is an error, with its text", async () => {
    messages.push({
      type: "result",
      subtype: "success",
      is_error: true,
      result: "API Error: 401",
    });
    await expect(searchWeb("x")).rejects.toThrow(
      "Web search failed: API Error: 401",
    );
  });

  it("throws when no result comes", async () => {
    await expect(searchWeb("x")).rejects.toThrow("without a reply");
  });

  it("stops a run that takes too long", async () => {
    query.mockImplementationOnce(untilAborted);
    await expect(searchWeb("x", undefined, 10)).rejects.toThrow(
      "stopped after 0.01 seconds",
    );
  });

  it("never starts a run for a call already stopped", async () => {
    const stop = new AbortController();
    stop.abort();
    await expect(searchWeb("x", stop.signal)).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });

  it("names a failure that has no error text", async () => {
    messages.push({
      type: "result",
      subtype: "error_max_turns",
      is_error: true,
      errors: [],
    });
    await expect(searchWeb("x")).rejects.toThrow(
      "Web search failed: error_max_turns",
    );
  });

  it("aborts the run with the tool call", async () => {
    query.mockImplementationOnce(untilAborted);
    const stop = new AbortController();
    const search = searchWeb("x", stop.signal);
    stop.abort();
    await expect(search).rejects.toThrow("without a reply");
  });
});

describe("claudeSignedIn", () => {
  it("keeps a yes without asking again", async () => {
    const code = claudeCode(true);
    expect(await claudeSignedIn(code)).toBe(true);
    expect(await claudeSignedIn(code)).toBe(true);
    expect(code.status).toHaveBeenCalledTimes(1);
  });

  it("asks again after a no once it's old", async () => {
    vi.useFakeTimers();
    try {
      const code = claudeCode(false);
      expect(await claudeSignedIn(code)).toBe(false);
      expect(await claudeSignedIn(code)).toBe(false);
      expect(code.status).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(30_001);
      await claudeSignedIn(code);
      expect(code.status).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("counts a failed check as signed out", async () => {
    expect(await claudeSignedIn(claudeCode(new Error("boom")))).toBe(false);
  });
});

describe("webSearch", () => {
  const register = async (loggedIn: boolean) => {
    const registerTool = vi.fn();
    await webSearch(
      { registerTool } as unknown as Parameters<typeof webSearch>[0],
      claudeCode(loggedIn),
    );
    return registerTool;
  };

  it("registers the tool only when Claude Code is signed in", async () => {
    expect(await register(false)).not.toHaveBeenCalled();
    clearLogin();
    const registerTool = await register(true);
    expect(registerTool.mock.calls[0][0].name).toBe("web_search");
  });

  it("returns the search as the tool's text", async () => {
    messages.push({ type: "result", subtype: "success", result: "found" });
    const tool = (await register(true)).mock.calls[0][0];
    expect(await tool.execute("id", { request: "x" })).toEqual({
      content: [{ type: "text", text: "found" }],
      details: {},
    });
  });
});
