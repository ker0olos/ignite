import { describe, expect, it } from "vitest";
import type { UserMessage } from "../../shared/agentTypes";
import { applyRouting, pickNote, shownItems } from "./routedMessage";
import { EMPTY } from "./transcript";

const user: UserMessage = { role: "user", content: "Fix it", timestamp: 7 };
const SONNET = {
  provider: "anthropic",
  id: "claude-sonnet-5-5",
  name: "Claude Sonnet 5.5",
};

describe("pickNote", () => {
  it("says what the router picked, or that it kept the default", () => {
    expect(pickNote({ model: SONNET, effort: "medium", kept: false })).toBe(
      "Router picked Sonnet 5.5 · Medium",
    );
    expect(pickNote({ model: SONNET, effort: "high", kept: true })).toBe(
      "Router kept your default, Sonnet 5.5 · High",
    );
  });

  it("says nothing without a model", () => {
    expect(pickNote({ effort: "low", kept: true })).toBeNull();
  });
});

describe("applyRouting", () => {
  const routing = applyRouting(EMPTY, { type: "routing_start", message: user });

  it("puts the pick above the first message once routed", () => {
    const sent = applyRouting(routing, {
      type: "routing_end",
      sent: true,
      picked: { model: SONNET, effort: "low", kept: false },
    });
    expect(shownItems(sent)).toEqual([
      { kind: "notice", text: "Router picked Sonnet 5.5 · Low" },
      { kind: "message", message: user },
    ]);
  });

  it("adds no line when it reports no pick", () => {
    const sent = applyRouting(routing, { type: "routing_end", sent: true });
    expect(sent.items).toEqual([]);
  });
});
