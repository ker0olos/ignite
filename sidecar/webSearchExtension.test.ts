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

const { limitUntil } = await import("./fallback.ts");
const LIMIT = Symbol.for("ignite.subscriptionLimit");
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
      code.status.mockResolvedValue({ installed: true, loggedIn: true });
      // The old no answers at once while it's checked again.
      expect(await claudeSignedIn(code)).toBe(false);
      expect(code.status).toHaveBeenCalledTimes(2);
      expect(await claudeSignedIn(code)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("counts a failed check as signed out", async () => {
    expect(await claudeSignedIn(claudeCode(new Error("boom")))).toBe(false);
  });
});

describe("webSearch", () => {
  const register = (loggedIn: boolean) => {
    const registerTool = vi.fn();
    const handlers: Record<string, (event: unknown, ctx: unknown) => unknown> =
      {};
    let active = ["read"];
    webSearch(
      {
        registerTool,
        on: (name: string, handler: (typeof handlers)[string]) =>
          (handlers[name] = handler),
        getActiveTools: () => active,
        setActiveTools: (names: string[]) => (active = names),
      } as unknown as Parameters<typeof webSearch>[0],
      claudeCode(loggedIn),
    );
    return {
      tool: registerTool.mock.calls[0][0],
      handlers,
      active: () => active,
    };
  };

  // A conversation on `provider`, its replies from the API search "from the API".
  const on = (provider: string, oauth = false) => {
    const model = { provider, id: "m", cost: { output: 1 } };
    return {
      model,
      modelRegistry: {
        isUsingOAuth: () => oauth,
        getAll: () => [model],
        getAvailable: () => [model],
        streamSimple: () => ({
          result: async () => ({
            stopReason: "stop",
            content: [{ type: "text", text: "from the API" }],
          }),
        }),
      },
    };
  };

  const startRun = async (loggedIn: boolean, ctx: ReturnType<typeof on>) => {
    const { handlers, active } = register(loggedIn);
    await handlers.before_agent_start({}, ctx);
    return active();
  };

  const search = async (loggedIn: boolean, ctx: ReturnType<typeof on>) => {
    messages.push({ type: "result", subtype: "success", result: "found" });
    const { tool } = register(loggedIn);
    const result = await tool.execute(
      "id",
      { request: "x" },
      undefined,
      undefined,
      ctx,
    );
    return result.content[0].text;
  };

  it("is on for Claude Code only while it's signed in", async () => {
    expect(await startRun(false, on("claude-bridge"))).toEqual(["read"]);
    clearLogin();
    expect(register(true).tool.name).toBe("web_search");
    expect(await startRun(true, on("claude-bridge"))).toEqual([
      "read",
      "web_search",
    ]);
  });

  it("is on for an Anthropic key or a ChatGPT login without Claude Code", async () => {
    expect(await startRun(false, on("anthropic"))).toContain("web_search");
    expect(await startRun(false, on("openai-codex"))).toContain("web_search");
    expect(await startRun(false, on("google"))).toEqual(["read"]);
  });

  it("leaves pi's own Claude sign-in to Claude Code", async () => {
    expect(await startRun(false, on("anthropic", true))).toEqual(["read"]);
  });

  it("returns Claude Code's search as the tool's text", async () => {
    expect(await search(true, on("claude-bridge"))).toBe("found");
  });

  it("searches on a ChatGPT login's own API, signed in to Claude Code or not", async () => {
    expect(await search(true, on("openai-codex"))).toBe("from the API");
    expect(query).not.toHaveBeenCalled();
  });

  it("searches on an Anthropic key only while Claude Code can't", async () => {
    expect(await search(false, on("anthropic"))).toBe("from the API");
    clearLogin();
    expect(await search(true, on("anthropic"))).toBe("found");
    limitUntil(Date.now() + 60_000);
    try {
      expect(await search(true, on("anthropic"))).toBe("from the API");
    } finally {
      delete (globalThis as Record<symbol, unknown>)[LIMIT];
    }
  });
});
