/**
 * Calls waiting on the user that don't wait forever, so a run the user walked
 * away from carries on. A conversation's first waiting call (the one whose
 * prompt or question shows) starts its timer the moment it's first; still
 * unanswered when it runs out, it's answered as the user being away. After
 * AWAY_STRIKES in a row, later ones are answered at once, until the user is
 * back: they answer one, send a message, or touch the window (a key, a
 * click, focus moving). Being back never restarts a timer already running.
 */
import type { QuestionAnswer } from "../shared/questions.ts";
import type { ApprovalAsk, Away } from "./approvalAsk.ts";
import type { Agent } from "./hostTypes.ts";

/** Unanswered calls in a row after which the next ones don't wait. */
export const AWAY_STRIKES = 3;

/** In Auto, an approval nobody answers is denied after 2 minutes. */
export const APPROVAL_AWAY: Away = {
  afterMs: 2 * 60_000,
  reason: () =>
    "The user is away and didn't answer, so this call was denied. Don't try it again now: carry on with what you can do without it, and say in your final reply what still needs their approval.",
};

type Clock = {
  /** The call being timed. */
  id?: string;
  timer?: ReturnType<typeof setTimeout>;
  strikes: number;
};

const clocks = new WeakMap<Agent, Clock>();
// What the user has answered so far in a waiting call's questions, by call id.
const drafts = new Map<string, QuestionAnswer[]>();

function clockOf(agent: Agent) {
  let clock = clocks.get(agent);
  if (!clock) clocks.set(agent, (clock = { strikes: 0 }));
  return clock;
}

/** Times the conversation's first waiting call, unless it already is; `expire` answers it once its time is up. */
export function timeFirst(
  agent: Agent,
  expire: (id: string, ask: ApprovalAsk) => void,
) {
  const clock = clockOf(agent);
  const [id, ask] = agent.approvals.entries().next().value ?? [];
  if (clock.id === id) return;
  clearTimeout(clock.timer);
  clock.id = undefined;
  if (!id || !ask?.away) return;
  clock.id = id;
  const ms = clock.strikes >= AWAY_STRIKES ? 0 : ask.away.afterMs;
  clock.timer = setTimeout(() => {
    clock.id = undefined;
    clock.strikes++;
    expire(id, ask);
  }, ms);
  // Never what keeps a quitting sidecar alive.
  clock.timer.unref?.();
}

/** The user is back: later calls wait their full time again, not answered at once. */
export function userBack(agent: Agent) {
  clockOf(agent).strikes = 0;
}

/** Keeps the user's unsent answers to a waiting call's questions. */
export function keepDraft(toolCallId: string, answers: QuestionAnswer[]) {
  drafts.set(toolCallId, answers);
}

/** A call's unsent answers, forgotten. */
export function takeDraft(toolCallId: string) {
  const draft = drafts.get(toolCallId);
  drafts.delete(toolCallId);
  return draft;
}
