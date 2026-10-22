// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import {
  answeredAsSaved,
  keyFailed,
  keysAfter,
  limitedUntil,
  limitHit,
  limitUntil,
  resetFrom,
  resetIn,
} from "./fallback.ts";
import type { FallbackKey } from "./fallbackKeys.ts";

const LIMIT = Symbol.for("ignite.subscriptionLimit");
afterEach(() => {
  delete (globalThis as { [LIMIT]?: number })[LIMIT];
});

describe("limitHit", () => {
  it("knows claude-bridge's and Claude Code's wording of a plan limit", () => {
    for (const errorMessage of [
      "Claude quota exceeded — rate limit (five_hour) — resets 6:30:00 PM: You're out of extra usage",
      "You're out of extra usage · resets 6:30pm",
      "Claude AI usage limit reached",
    ])
      expect(limitHit({ stopReason: "error", errorMessage })).toBe(true);
  });

  it("leaves other failures and replies that didn't fail", () => {
    expect(limitHit({ stopReason: "error", errorMessage: "overloaded" })).toBe(
      false,
    );
    expect(limitHit({ stopReason: "error" })).toBe(false);
    expect(
      limitHit({ stopReason: "stop", errorMessage: "quota exceeded" }),
    ).toBe(false);
  });
});

describe("resetFrom", () => {
  const prefix = "anthropic-ratelimit-unified";

  it("reads a rejected window's reset, in milliseconds", () => {
    expect(
      resetFrom({
        [`${prefix}-status`]: "rejected",
        [`${prefix}-reset`]: "100",
      }),
    ).toBe(100_000);
  });

  it("ignores windows still allowed, and a reset it can't read", () => {
    expect(
      resetFrom({
        [`${prefix}-status`]: "allowed",
        [`${prefix}-reset`]: "100",
      }),
    ).toBeUndefined();
    expect(resetFrom({ [`${prefix}-status`]: "rejected" })).toBeUndefined();
  });

  it("ignores a rejected window overage still serves", () => {
    const rejected = {
      [`${prefix}-status`]: "rejected",
      [`${prefix}-reset`]: "100",
    };
    expect(
      resetFrom({ ...rejected, [`${prefix}-overage-status`]: "allowed" }),
    ).toBeUndefined();
    expect(
      resetFrom({ ...rejected, [`${prefix}-overage-status`]: "rejected" }),
    ).toBe(100_000);
  });
});

describe("keyFailed", () => {
  it("knows a key spent, refused or throttled", () => {
    for (const errorMessage of [
      "insufficient_quota",
      "Your credit balance is too low",
      "401 invalid x-api-key",
      "authentication_error",
      "429 Too Many Requests",
      "rate_limit_error",
    ])
      expect(keyFailed({ stopReason: "error", errorMessage })).toBe(true);
  });

  it("leaves failures another key wouldn't fix", () => {
    for (const errorMessage of [
      "overloaded",
      "500 server error",
      "prompt is too long",
    ])
      expect(keyFailed({ stopReason: "error", errorMessage })).toBe(false);
    expect(keyFailed({ stopReason: "stop", errorMessage: "401" })).toBe(false);
  });
});

describe("resetIn", () => {
  const now = new Date(2026, 9, 20, 15, 0).getTime();
  const at = (day: number, hours: number, minutes: number) =>
    new Date(2026, 9, day, hours, minutes).getTime();

  it("reads a 12-hour time later today", () => {
    expect(resetIn("resets 6:30:00 PM: out of usage", now)).toBe(
      at(20, 18, 30),
    );
    expect(resetIn("· resets 6:30pm", now)).toBe(at(20, 18, 30));
  });

  it("takes tomorrow for a time already past", () => {
    expect(resetIn("resets 9:15 AM", now)).toBe(at(21, 9, 15));
    expect(resetIn("resets 12:00 PM", now)).toBe(at(21, 12, 0));
    expect(resetIn("resets 12:05 AM", now)).toBe(at(21, 0, 5));
  });

  it("reads a 24-hour time", () => {
    expect(resetIn("resets 18:30:00", now)).toBe(at(20, 18, 30));
  });

  it("waits an hour when the error names no time", () => {
    expect(resetIn("quota exceeded", now)).toBe(now + 60 * 60 * 1000);
  });
});

describe("the subscription's limit", () => {
  it("is unknown until noted, and keeps the latest reset", () => {
    expect(limitedUntil()).toBe(0);
    limitUntil(200);
    limitUntil(100);
    expect(limitedUntil()).toBe(200);
  });
});

describe("keysAfter", () => {
  const key = (id: string): FallbackKey => ({ id, key: "k" });
  const keys = [key("a"), key("b"), key("c")];

  it("tries every key from the first when none is in use", () => {
    expect(keysAfter(keys).map((k) => k.id)).toEqual(["a", "b", "c"]);
    expect(keysAfter(keys, "gone").map((k) => k.id)).toEqual(["a", "b", "c"]);
  });

  it("tries those after the one in use", () => {
    expect(keysAfter(keys, "b").map((k) => k.id)).toEqual(["c"]);
    expect(keysAfter(keys, "c")).toEqual([]);
  });
});

describe("answeredAsSaved", () => {
  const reply = (stopReason: string, ids: string[]) => ({
    role: "assistant",
    stopReason,
    errorMessage: "Operation aborted",
    content: ids.map((id) => ({ type: "toolCall", id })),
  });
  const result = (id: string) => ({ role: "toolResult", toolCallId: id });

  it("restores a failed reply whose tool calls all came back", () => {
    for (const stopReason of ["aborted", "error"]) {
      const [restored] = answeredAsSaved([
        reply(stopReason, ["a", "b"]),
        result("a"),
        result("b"),
      ]);
      expect(restored).toMatchObject({
        stopReason: "toolUse",
        errorMessage: undefined,
      });
    }
  });

  it("leaves a failed reply with a call that never came back, or none, and replies that didn't fail", () => {
    const messages = [
      reply("aborted", ["a", "b"]),
      result("a"),
      reply("error", []),
      reply("toolUse", ["c"]),
      { role: "user" },
    ];
    expect(answeredAsSaved(messages)).toEqual(messages);
  });
});

it("leaves a failed reply with no content list", () => {
  const messages = [{ role: "assistant", stopReason: "error" }];
  expect(answeredAsSaved(messages)).toEqual(messages);
});
