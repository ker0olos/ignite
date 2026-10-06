import { describe, expect, it } from "vitest";
import type { AgentMessage, AssistantMessage } from "../../shared/agentTypes";
import type { Transcript } from "./transcript";
import {
  currentStep,
  elapsed,
  runStart,
  latestThought,
  workingLine,
} from "./runStep";

const assistant = (content: AssistantMessage["content"]): AgentMessage => ({
  role: "assistant",
  content,
  provider: "p",
  model: "m",
  stopReason: "pending",
  timestamp: 2,
});
const call = (id: string, name: string, args = {}) =>
  ({ type: "toolCall", id, name, arguments: args }) as const;
const user: AgentMessage = { role: "user", content: "hi", timestamp: 5 };

describe("currentStep", () => {
  it("works with no assistant message", () => {
    expect(currentStep([user], {}, "/w")).toBe("Working");
  });

  it("names a call that has no run yet", () => {
    const m = [assistant([call("a", "edit", { path: "/w/x.ts" })])];
    expect(currentStep(m, {}, "/w")).toBe("Editing x.ts");
  });

  it("names the last running call, skipping finished ones", () => {
    const m = [
      assistant([
        call("a", "read", { path: "a.ts" }),
        call("b", "grep"),
        call("c", "write", { path: "c.ts" }),
      ]),
    ];
    const tools = {
      a: { status: "running" },
      b: { status: "running" },
      c: { status: "done" },
    } as const;
    expect(currentStep(m, tools, "/w")).toBe("Searching the code");
  });

  it("falls back to Working when the step is unnamed", () => {
    const m = [assistant([call("a", "ask_user")])];
    expect(currentStep(m, {}, "/w")).toBe("Working");
  });

  it("says Thinking after a thinking block", () => {
    const m = [
      assistant([
        call("a", "read", { path: "a" }),
        { type: "thinking", thinking: "..." },
      ]),
    ];
    expect(currentStep(m, { a: { status: "done" } }, "/w")).toBe("Thinking");
  });

  it("ignores the reply before the last user message", () => {
    const m = [assistant([{ type: "thinking", thinking: "old" }]), user];
    expect(currentStep(m, {}, "/w")).toBe("Working");
  });

  it("says Working otherwise", () => {
    const m = [assistant([{ type: "text", text: "hi" }])];
    expect(currentStep(m, {}, "/w")).toBe("Working");
  });
});

describe("runStart", () => {
  it("is the last user message's time", () => {
    const later: AgentMessage = { ...user, timestamp: 9 };
    expect(runStart([user, assistant([]), later])).toBe(9);
  });

  it("is undefined without one", () => {
    expect(runStart([assistant([])])).toBeUndefined();
  });
});

describe("elapsed", () => {
  it.each([
    [0, "0s"],
    [59_999, "59s"],
    [60_000, "1m 0s"],
    [725_000, "12m 5s"],
    [-5, "0s"],
  ])("%i → %s", (ms, text) => {
    expect(elapsed(ms)).toBe(text);
  });
});

describe("workingLine thought", () => {
  const line = (content: AssistantMessage["content"]) => {
    const t: Transcript = {
      items: [{ kind: "message", message: assistant(content) }],
      tools: {},
      running: true,
    };
    return workingLine(t, "/w", true)?.thought;
  };

  it("is the newest sentence of a trailing thinking block", () => {
    expect(
      line([{ type: "thinking", thinking: "First one. Then the second" }]),
    ).toBe("Then the second");
  });

  it("is the last finished sentence when one just ended", () => {
    expect(line([{ type: "thinking", thinking: "Done here. " }])).toBe(
      "Done here.",
    );
  });

  it("splits on line breaks too", () => {
    expect(line([{ type: "thinking", thinking: "**Plan**\n\nRead it" }])).toBe(
      "Read it",
    );
  });

  it("is left out unless asked for", () => {
    const t: Transcript = {
      items: [
        {
          kind: "message",
          message: assistant([{ type: "thinking", thinking: "why" }]),
        },
      ],
      tools: {},
      running: true,
    };
    expect(workingLine(t, "/w", false)?.thought).toBeUndefined();
  });

  it("is undefined for empty thinking", () => {
    expect(line([{ type: "thinking", thinking: "" }])).toBeUndefined();
  });

  it("is undefined when the last block isn't thinking", () => {
    expect(
      line([
        { type: "thinking", thinking: "why" },
        { type: "text", text: "hi" },
      ]),
    ).toBeUndefined();
  });
});

describe("workingLine routing", () => {
  const routing: Transcript = {
    items: [
      {
        kind: "message",
        message: assistant([{ type: "thinking", thinking: "old" }]),
      },
    ],
    tools: {},
    running: true,
    routing: true,
    routedAt: 500,
  };

  it("shows Routing… with no thought, timed from when the message was sent", () => {
    expect(workingLine(routing, "/w", true)).toEqual({
      step: "Routing…",
      since: 500,
    });
  });

  it("keeps timing from the send once pi has the message", () => {
    const sent = {
      ...routing,
      routing: false,
      items: [
        { kind: "message" as const, message: { ...user, timestamp: 900 } },
      ],
    };
    expect(workingLine(sent, "/w", false)?.since).toBe(500);
    expect(
      workingLine({ ...sent, routedAt: undefined }, "/w", false)?.since,
    ).toBe(900);
  });

  it("goes back to the run's step once routed", () => {
    expect(workingLine({ ...routing, routing: false }, "/w", false)?.step).toBe(
      "Thinking",
    );
  });
});

describe("latestThought", () => {
  const thinking = (text: string, redacted?: boolean) =>
    assistant([{ type: "thinking", thinking: text, redacted }]);

  it("reads only the end of long reasoning", () => {
    expect(latestThought([thinking("a".repeat(1000))])).toHaveLength(600);
  });

  it("skips redacted thinking", () => {
    expect(latestThought([thinking("opaque", true)])).toBeUndefined();
  });

  it("skips a previous run's thinking", () => {
    expect(latestThought([thinking("old"), user])).toBeUndefined();
  });
});
