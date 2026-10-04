import { describe, expect, it } from "vitest";
import type { AgentStatus } from "../../shared/hostProtocol";
import { notices } from "./notifications";

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
      { session: "s1", title: "Fix bug · app", body: "Waiting for you" },
    ]);
  });

  it("says a new conversation is already waiting", () => {
    expect(notices([], [agent({ waiting: true })])).toHaveLength(1);
  });

  it("names a pull request ready for review", () => {
    const review = {
      toolCallId: "t",
      review: { kind: "pr" as const, repo: "/r", range: "", files: [] },
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
