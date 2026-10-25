import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApprovalAsk, Away } from "./approvalAsk.ts";
import { APPROVAL_AWAY, AWAY_STRIKES } from "./awayTimer.ts";
import { answered } from "./hostAnswers.ts";
import { askApproval, denyAll } from "./hostApproval.ts";
import type { Agent, HostContext } from "./hostTypes.ts";

vi.mock("./waitingCalls.ts", () => ({
  markWaiting: vi.fn(),
  unmarkWaiting: vi.fn(),
  forgetWaiting: vi.fn(),
}));
vi.mock("./hostProjects.ts", () => ({ pushProjects: vi.fn() }));

const MIN = 60_000;
const AWAY = APPROVAL_AWAY.reason();

function setup() {
  const agent = {
    id: "s1",
    approvals: new Map(),
    toolRuns: new Map(),
  } as unknown as Agent;
  const ctx = {
    agents: new Map([["s1", agent]]),
    send: vi.fn(),
    shown: null,
  } as unknown as HostContext;
  // `false`: a call that waits forever, like a git review.
  const ask = (toolCallId: string, away: Away | false = APPROVAL_AWAY) => {
    const answer = vi.fn();
    askApproval(ctx, agent, {
      request: { toolCallId },
      answer,
      away: away || undefined,
    });
    return answer;
  };
  const reply = (toolCallId: string, approved = true) =>
    answered(ctx, { type: "approval_answer", toolCallId, approved });
  return { agent, ctx, ask, reply };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the away timer", () => {
  it("denies the first waiting call once its time is up, saying the user is away", () => {
    const { agent, ask } = setup();
    const answer = ask("t1");
    vi.advanceTimersByTime(2 * MIN - 1);
    expect(answer).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(answer).toHaveBeenCalledWith(false, undefined, undefined, AWAY);
    expect(agent.approvals.size).toBe(0);
  });

  it("times only the first in line; the next starts its full time once it's first", () => {
    const { ask, reply } = setup();
    const first = ask("t1");
    vi.advanceTimersByTime(MIN);
    const second = ask("t2");
    vi.advanceTimersByTime(30_000);
    reply("t1");
    expect(first).toHaveBeenCalledWith(true, undefined, undefined);
    vi.advanceTimersByTime(2 * MIN - 1);
    expect(second).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(second).toHaveBeenCalledWith(false, undefined, undefined, AWAY);
  });

  it("never times a call that waits forever, nor the calls behind it", () => {
    const { ask } = setup();
    const review = ask("git", false);
    const behind = ask("t2");
    vi.advanceTimersByTime(60 * MIN);
    expect(review).not.toHaveBeenCalled();
    expect(behind).not.toHaveBeenCalled();
  });

  it("stops the timer when the run stops", () => {
    const { agent, ctx, ask } = setup();
    const answer = ask("t1");
    denyAll(ctx, agent);
    expect(answer).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(10 * MIN);
    expect(answer).toHaveBeenCalledOnce();
  });

  it("sends the user's unsent answers with an expired question", () => {
    const { ctx, ask } = setup();
    const reason = vi.fn(() => "away");
    const answer = ask("q1", { afterMs: 5 * MIN, reason });
    const draft = [{ question: "Where?", choices: ["SQLite"] }];
    answered(ctx, { type: "question_draft", toolCallId: "q1", answers: draft });
    // A draft for a call that doesn't wait is dropped.
    answered(ctx, { type: "question_draft", toolCallId: "gone", answers: [] });
    vi.advanceTimersByTime(5 * MIN);
    expect(reason).toHaveBeenCalledWith(draft);
    expect(answer).toHaveBeenCalledWith(false, draft, undefined, "away");
  });

  it(`after ${AWAY_STRIKES} unanswered calls, denies the next at once until the user is back`, () => {
    const { ctx, ask } = setup();
    for (let i = 0; i < AWAY_STRIKES; i++) {
      ask(`t${i}`);
      vi.advanceTimersByTime(2 * MIN);
    }
    const next = ask("next");
    vi.advanceTimersByTime(0);
    expect(next).toHaveBeenCalledWith(false, undefined, undefined, AWAY);
    // Touching the window brings them back, but doesn't restart a running timer.
    const waiting = ask("waiting");
    answered(ctx, { type: "user_active" });
    vi.advanceTimersByTime(0);
    expect(waiting).toHaveBeenCalledOnce();
    const later = ask("later");
    vi.advanceTimersByTime(2 * MIN - 1);
    expect(later).not.toHaveBeenCalled();
  });

  it("counts from zero again once the user answers one", () => {
    const { ask, reply } = setup();
    for (let i = 0; i < AWAY_STRIKES - 1; i++) {
      ask(`t${i}`);
      vi.advanceTimersByTime(2 * MIN);
    }
    ask("answered");
    reply("answered", false);
    ask("t9");
    vi.advanceTimersByTime(2 * MIN);
    const next = ask("next");
    vi.advanceTimersByTime(MIN);
    expect(next).not.toHaveBeenCalled();
  });

  it("leaves a call answered meanwhile alone", () => {
    const { agent, ask } = setup();
    const answer = ask("t1");
    // Replaced under the same id (a reopened conversation asking again).
    const again: ApprovalAsk = {
      request: { toolCallId: "t1" },
      answer: vi.fn(),
    };
    agent.approvals.set("t1", again);
    vi.advanceTimersByTime(2 * MIN);
    expect(answer).not.toHaveBeenCalled();
    expect(again.answer).not.toHaveBeenCalled();
  });
});
