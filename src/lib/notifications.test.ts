import { describe, expect, it } from "vitest";
import type { AgentStatus } from "../../shared/hostProtocol";
import { chime, notices, stillAsNotified } from "./notifications";

const agent = (over: Partial<AgentStatus> = {}): AgentStatus => ({
  cwd: "/work/app",
  session: "s1",
  title: "Fix bug",
  running: false,
  waiting: false,
  ...over,
});

describe("notices", () => {
  it("says a conversation started waiting", () => {
    expect(
      notices([agent({ running: true })], [agent({ waiting: true })]),
    ).toEqual([
      {
        session: "s1",
        cwd: "/work/app",
        waiting: true,
        title: "Fix bug · app",
        body: "Waiting for you",
      },
    ]);
  });

  it("says a new conversation is already waiting", () => {
    expect(notices([], [agent({ waiting: true })])).toHaveLength(1);
  });

  it("names a pull request ready for review", () => {
    const review = {
      toolCallId: "t",
      review: {
        kind: "commit" as const,
        repo: "/r",
        range: "",
        files: [],
        pr: {
          repo: "a/b",
          base: "main",
          head: "x",
          title: "T",
          body: "",
          draft: false,
        },
      },
    };
    expect(notices([], [agent({ waiting: true, review })])[0].body).toBe(
      "Pull request ready for review",
    );
  });

  it("does not repeat while it keeps waiting", () => {
    const w = agent({ waiting: true });
    expect(notices([w], [w])).toEqual([]);
  });

  it("says a running conversation finished", () => {
    expect(notices([agent({ running: true })], [agent()])[0].body).toBe(
      "Finished",
    );
  });

  it("says a run that ended in an error stopped", () => {
    expect(
      notices([agent({ running: true })], [agent({ failed: true })])[0].body,
    ).toBe("Stopped with an error");
  });

  it("says nothing for idle, still running or vanished conversations", () => {
    expect(notices([agent()], [agent()])).toEqual([]);
    expect(
      notices([agent({ running: true })], [agent({ running: true })]),
    ).toEqual([]);
    expect(notices([agent({ running: true })], [])).toEqual([]);
  });

  it("falls back to a generic title", () => {
    expect(notices([], [agent({ title: "", waiting: true })])[0].title).toBe(
      "Conversation · app",
    );
  });
});

describe("chime", () => {
  it("is a macOS system sound on the Mac, else the freedesktop one", () => {
    expect(chime(true)).toBe("Glass");
    expect(chime(false)).toBe("message-new-instant");
  });
});

describe("stillAsNotified", () => {
  const waiting = { session: "s1", waiting: true };
  const finished = { session: "s1", waiting: false };

  it("holds while the conversation is open and as notified", () => {
    expect(stillAsNotified(waiting, [agent({ waiting: true })])).toBe(true);
    expect(stillAsNotified(finished, [agent()])).toBe(true);
  });

  it("fails once it's closed, answered, or running again", () => {
    expect(stillAsNotified(waiting, [])).toBe(false);
    expect(stillAsNotified(waiting, [agent({ running: true })])).toBe(false);
    expect(stillAsNotified(finished, [agent({ running: true })])).toBe(false);
  });
});
