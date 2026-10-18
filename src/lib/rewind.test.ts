import { describe, expect, it } from "vitest";
import type { AgentMessage, UserMessage } from "../../shared/agentTypes";
import {
  applyRewindEvent,
  canRewind,
  editableEntries,
  userParts,
} from "./rewind";
import { applyEvent, EMPTY, fromHistory, type Item } from "./transcript";

const user = (text: string, timestamp: number, entryId?: string) =>
  ({
    role: "user",
    content: text,
    timestamp,
    ...(entryId && { entryId }),
  }) as UserMessage;
const reply: AgentMessage = {
  role: "assistant",
  content: [{ type: "text", text: "Done" }],
  provider: "p",
  model: "m",
  stopReason: "stop",
  timestamp: 3,
};
const message = (m: AgentMessage): Item => ({ kind: "message", message: m });

describe("message entries", () => {
  it("names the newest unnamed user message sent at that time", () => {
    const t = fromHistory([user("a", 1, "u1"), user("b", 1), reply], false);
    const named = applyEvent(t, {
      type: "message_entry",
      timestamp: 1,
      entryId: "u2",
    });
    expect(named.items[1]).toEqual(message(user("b", 1, "u2")));
    expect(named.items[0]).toBe(t.items[0]);
  });

  it("leaves the conversation for other events", () => {
    expect(applyRewindEvent(EMPTY, { type: "turn_end" })).toBe(EMPTY);
  });

  it("leaves the conversation when no message matches", () => {
    const t = fromHistory([user("a", 1, "u1")], false);
    expect(
      applyEvent(t, { type: "message_entry", timestamp: 9, entryId: "u9" }),
    ).toBe(t);
  });
});

describe("rewound", () => {
  const t = fromHistory(
    [user("a", 1, "u1"), reply, user("b", 2, "u2"), reply],
    false,
  );

  it("drops the edited message and everything after it from view", () => {
    const back = applyEvent(t, {
      type: "rewound",
      entryId: "u2",
      files: "restored",
    });
    expect(back.items).toEqual([message(user("a", 1, "u1")), message(reply)]);
  });

  it("says when the files couldn't go back", () => {
    const back = applyEvent(t, {
      type: "rewound",
      entryId: "u1",
      files: "missing",
    });
    expect(back.items).toEqual([
      {
        kind: "notice",
        text: "Files stay as they are: they weren't saved before that message.",
      },
    ]);
  });

  it("stays as it is for a message it doesn't show", () => {
    expect(
      applyEvent(t, { type: "rewound", entryId: "gone", files: "shared" }),
    ).toBe(t);
  });
});

describe("editableEntries", () => {
  it("offers Edit on named user messages after the latest compaction", () => {
    const items: Item[] = [
      message(user("old", 1, "u1")),
      { kind: "compaction", summary: "S", tokensBefore: 10 },
      message(user("kept", 2)),
      message(user("new", 3, "u3")),
      message(reply),
    ];
    expect([...editableEntries(items)]).toEqual(["u3"]);
    expect([...editableEntries(items.slice(0, 1))]).toEqual(["u1"]);
  });
});

describe("canRewind", () => {
  const idle = fromHistory([user("a", 1, "u1")], false);

  it("allows editing while the conversation is idle", () => {
    expect(canRewind(idle, false)).toBe(true);
  });

  it.each([
    ["running", { ...idle, running: true }],
    ["routing", { ...idle, routing: true }],
    [
      "waiting on approval",
      { ...idle, tools: { c1: { status: "running", approval: {} } } },
    ],
    ["compacting", { ...idle, items: [{ kind: "compaction" }] }],
    [
      "with a message queued",
      { ...idle, queued: [{ kind: "steer", text: "x" }] },
    ],
  ] as const)("refuses while %s", (_, t) => {
    expect(canRewind(t as typeof idle, false)).toBe(false);
  });

  it("refuses while it waits on a fork", () => {
    expect(canRewind(EMPTY, true)).toBe(false);
  });
});

describe("userParts", () => {
  it("reads text, a skill as typed, and images", () => {
    const image = {
      type: "image" as const,
      data: "AA==",
      mimeType: "image/png",
    };
    expect(userParts(user("hi", 1))).toEqual({ text: "hi", images: [] });
    expect(
      userParts({
        role: "user",
        content: [
          {
            type: "text",
            text: '<skill name="review" location="x">\nR\n</skill>\n\nnow',
          },
          image,
        ],
        timestamp: 1,
      }),
    ).toEqual({ text: "/review now", images: [image] });
  });
});
