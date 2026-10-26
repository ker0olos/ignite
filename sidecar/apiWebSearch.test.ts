import { describe, expect, it, vi } from "vitest";
import { searchApi, searchesOwnApi } from "./apiWebSearch.ts";

type Reply = {
  stopReason: string;
  errorMessage?: string;
  content: { type: string; text?: string }[];
};

const model = (provider: string, id: string, output = 0) => ({
  provider,
  id,
  cost: { output },
});

const context = (
  own: ReturnType<typeof model>,
  reply: Reply | ((signal: AbortSignal) => Promise<Reply>),
  available = [own],
) => {
  const streamSimple = vi.fn(
    (
      _model: unknown,
      _context: unknown,
      options: {
        signal: AbortSignal;
        onPayload(payload: unknown): unknown;
      },
    ) => ({
      result: () =>
        typeof reply === "function"
          ? reply(options.signal)
          : Promise.resolve(reply),
    }),
  );
  const ctx = {
    model: own,
    modelRegistry: {
      isUsingOAuth: () => false,
      getAll: () => available,
      getAvailable: () => available,
      streamSimple,
    },
  } as unknown as Parameters<typeof searchApi>[0];
  return { ctx, streamSimple };
};

const text = (...parts: string[]): Reply => ({
  stopReason: "stop",
  content: parts.map((t) => ({ type: "text", text: t })),
});

describe("searchesOwnApi", () => {
  const on = (provider?: string, oauth = false) =>
    searchesOwnApi({
      model: provider ? model(provider, "m") : undefined,
      modelRegistry: { isUsingOAuth: () => oauth },
    } as unknown as Parameters<typeof searchesOwnApi>[0]);

  it("is an Anthropic key or a ChatGPT login only", () => {
    expect(on("anthropic")).toBe(true);
    expect(on("openai-codex")).toBe(true);
    expect(on("claude-bridge")).toBe(false);
    expect(on(undefined)).toBe(false);
  });

  it("leaves out pi's own Claude sign-in", () => {
    expect(on("anthropic", true)).toBe(false);
    expect(on("openai-codex", true)).toBe(true);
  });
});

describe("searchApi", () => {
  it("asks the provider's cheapest model, with Anthropic's search tool added", async () => {
    const opus = model("anthropic", "claude-opus-5-5", 20);
    const haiku = model("anthropic", "claude-haiku-5-5", 0.5);
    const other = model("openai-codex", "gpt-6-luna", 0.1);
    const { ctx, streamSimple } = context(opus, text("found ", "it"), [
      opus,
      haiku,
      other,
    ]);
    expect(await searchApi(ctx, "react 19", "prompt")).toBe("found it");
    const [picked, sent, options] = streamSimple.mock.calls[0];
    expect(picked).toBe(haiku);
    expect(sent).toMatchObject({
      systemPrompt: "prompt",
      messages: [{ role: "user", content: "react 19" }],
    });
    expect(options.onPayload({ model: "m", tools: [{ name: "x" }] })).toEqual({
      model: "m",
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
    });
  });

  it("adds Codex's search tool on a ChatGPT login", async () => {
    const luna = model("openai-codex", "gpt-6-luna", 0.1);
    const { ctx, streamSimple } = context(luna, text("found"));
    await searchApi(ctx, "x", "prompt");
    const options = streamSimple.mock.calls[0][2];
    expect(options.onPayload({})).toEqual({ tools: [{ type: "web_search" }] });
  });

  it("falls back to the conversation's model when none is priced", async () => {
    const own = model("openai-codex", "gpt-6-luna");
    const { ctx, streamSimple } = context(own, text("found"));
    await searchApi(ctx, "x", "prompt");
    expect(streamSimple.mock.calls[0][0]).toBe(own);
  });

  it("refuses a provider without its own search", async () => {
    const { ctx } = context(model("google", "gemini"), text("x"));
    await expect(searchApi(ctx, "x", "prompt")).rejects.toThrow(
      "isn't available",
    );
  });

  it("throws the provider's error", async () => {
    const { ctx } = context(model("anthropic", "claude-haiku-5-5", 0.5), {
      stopReason: "error",
      errorMessage: "401",
      content: [],
    });
    await expect(searchApi(ctx, "x", "prompt")).rejects.toThrow(
      "Web search failed: 401",
    );
  });

  it("names a stop without an error message", async () => {
    const { ctx } = context(model("anthropic", "claude-haiku-5-5", 0.5), {
      stopReason: "aborted",
      content: [],
    });
    await expect(searchApi(ctx, "x", "prompt")).rejects.toThrow(
      "Web search failed: aborted",
    );
  });

  it("says when it took too long", async () => {
    const { ctx } = context(
      model("anthropic", "claude-haiku-5-5", 0.5),
      (signal) =>
        new Promise((done) =>
          signal.addEventListener("abort", () =>
            done({ stopReason: "aborted", content: [] }),
          ),
        ),
    );
    await expect(searchApi(ctx, "x", "prompt", undefined, 10)).rejects.toThrow(
      "stopped after 0.01 seconds",
    );
  });

  it("throws when the reply has no text", async () => {
    const { ctx } = context(model("anthropic", "claude-haiku-5-5", 0.5), {
      stopReason: "stop",
      content: [{ type: "thinking" }],
    });
    await expect(searchApi(ctx, "x", "prompt")).rejects.toThrow(
      "without a reply",
    );
  });
});
