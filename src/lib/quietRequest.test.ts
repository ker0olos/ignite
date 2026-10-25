import { describe, expect, it } from "vitest";
import type { AgentMessage } from "../../shared/agentTypes";
import { quietRequest } from "@/lib/quietRequest";

const user = (timestamp = 1): AgentMessage => ({
  role: "user",
  content: "go",
  timestamp,
});

const reply = (over: Record<string, unknown> = {}, tokens = 0): AgentMessage =>
  ({
    role: "assistant",
    content: [{ type: "text", text: "ok" }],
    provider: "claude-bridge",
    model: "claude-opus-5-5",
    stopReason: "stop",
    timestamp: 2,
    usage: { input: tokens, output: 0, cacheRead: 0, cacheWrite: 0 },
    ...over,
  }) as AgentMessage;

const started = (over: Record<string, unknown> = {}) =>
  reply({ stopReason: "pending", content: [], timestamp: 8, ...over });

const onKey = { provider: "anthropic" };

const limit = reply({
  stopReason: "error",
  errorMessage:
    "Claude quota exceeded — rate limit (seven_day) — resets 2:00:00 PM: You've hit your weekly limit",
  timestamp: 5,
});

describe("quietRequest", () => {
  it("waits from the message or tool result the request answers", () => {
    expect(quietRequest([user(7)])).toEqual({
      since: 7,
      reason: expect.stringContaining("may be thinking"),
    });
    const result = { role: "toolResult", timestamp: 9 } as AgentMessage;
    expect(quietRequest([user(), result])?.since).toBe(9);
  });

  it("waits on a reply that started with nothing in it yet", () => {
    expect(quietRequest([user(), started()])?.since).toBe(8);
  });

  it("is quiet for nothing while a reply streams, after one ends, or with no timestamp", () => {
    expect(quietRequest([])).toBeUndefined();
    expect(quietRequest([user(), reply({ stopReason: "pending" })])).toBe(
      undefined,
    );
    expect(quietRequest([user(), reply()])).toBeUndefined();
    expect(quietRequest([user(), limit])).toBeUndefined();
    expect(quietRequest([{ role: "custom" } as AgentMessage])).toBeUndefined();
  });

  it("says a limit moved it to the API key, timed from the key's own request", () => {
    const quiet = quietRequest([
      reply({}, 190_400),
      user(),
      limit,
      started(onKey),
    ]);
    expect(quiet?.since).toBe(8);
    expect(quiet?.reason).toContain("Claude hit its limit");
    expect(quiet?.reason).toContain("all 190k tokens");
  });

  it("says a run that started on the key is on it, not the subscription", () => {
    const quiet = quietRequest([reply({}, 50_000), user(), started(onKey)]);
    expect(quiet?.reason).toMatch(/^This is on your API key now/);
  });

  it("names the model a switch went to", () => {
    const sonnet = started({ model: "claude-sonnet-5-5" });
    expect(quietRequest([reply(), user(), sonnet])?.reason).toMatch(
      /^This is on claude-sonnet-5-5 now/,
    );
    const codex = started({ provider: "openai-codex", model: "gpt-5.5" });
    expect(quietRequest([reply(), user(), codex])?.reason).toMatch(
      /^This is on gpt-5.5 now/,
    );
  });

  it("says a long conversation takes reading, sized by its latest answered request", () => {
    const quiet = quietRequest([reply({}, 150_000), user(), started()]);
    expect(quiet?.reason).toContain("Long conversation (150k tokens)");
    expect(quietRequest([reply({}, 90_000), user()])?.reason).toContain(
      "may be thinking",
    );
  });

  it("names no size when no request reported one", () => {
    const noUsage = reply({ usage: undefined });
    expect(
      quietRequest([noUsage, user(), limit, started(onKey)])?.reason,
    ).toContain("the whole conversation fresh");
  });
});
