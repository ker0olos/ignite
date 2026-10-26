// The first waiting call's timer: unanswered when it runs out, it's answered as the user being away.
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
  expire?: () => void;
  strikes: number;
};

const clocks = new WeakMap<Agent, Clock>();

function clockOf(agent: Agent) {
  let clock = clocks.get(agent);
  if (!clock) clocks.set(agent, (clock = { strikes: 0 }));
  return clock;
}

function arm(clock: Clock, ms: number) {
  clearTimeout(clock.timer);
  clock.timer = setTimeout(() => clock.expire?.(), ms);
  // Never what keeps a quitting sidecar alive.
  clock.timer.unref?.();
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
  clock.expire = () => {
    clock.id = undefined;
    if (agent.approvals.get(id) !== ask) return;
    clock.strikes++;
    expire(id, ask);
  };
  arm(clock, clock.strikes >= AWAY_STRIKES ? 0 : ask.away.afterMs);
}

/** The user is back: later calls wait their full time again; `looking` at the conversation, its timed call starts afresh too. */
export function userBack(agent: Agent, looking = false) {
  const clock = clockOf(agent);
  clock.strikes = 0;
  const away = looking && clock.id && agent.approvals.get(clock.id)?.away;
  if (away) arm(clock, away.afterMs);
}
