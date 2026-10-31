import type { QuestionAnswer } from "../shared/questions.ts";
import type { ApprovalAsk } from "./approvalAsk.ts";
import { timeFirst, userBack } from "./awayTimer.ts";
import { tellsApp, type Agent, type HostContext } from "./hostTypes.ts";
import { pushProjects } from "./hostProjects.ts";
import { noteDenied } from "./hostReflect.ts";
import { forgetWaiting, markWaiting, unmarkWaiting } from "./waitingCalls.ts";

/** Keeps a tool call's question, and passes it on if the app follows its conversation. */
export function askApproval(ctx: HostContext, agent: Agent, ask: ApprovalAsk) {
  const id = ask.request.toolCallId;
  agent.approvals.set(id, ask);
  if (own(agent, id)) markWaiting(agent.id, id, ask.wait ?? "asking");
  if (tellsApp(ctx, agent)) {
    ctx.send({
      type: "approval_request",
      session: agent.id,
      request: ask.request,
    });
  }
  ask.signal?.addEventListener("abort", () => drop(ctx, agent, id, ask), {
    once: true,
  });
  pushProjects(ctx);
  timeAway(ctx, agent);
}

// The call no longer waits, its answer given or not.
function drop(ctx: HostContext, agent: Agent, id: string, ask: ApprovalAsk) {
  if (agent.approvals.get(id) !== ask) return false;
  agent.approvals.delete(id);
  unmarkWaiting(agent.id, id);
  pushProjects(ctx);
  timeAway(ctx, agent);
  return true;
}

// The first waiting call's time starts; once it's up, the call is answered as the user being away.
const timeAway = (ctx: HostContext, agent: Agent) =>
  timeFirst(
    agent,
    (id, ask) => {
      if (drop(ctx, agent, id, ask))
        ask.answer(false, ask.draft, undefined, ask.away?.reason(ask.draft));
    },
    ({ request }) => {
      if (tellsApp(ctx, agent))
        ctx.send({ type: "approval_away", session: agent.id, request });
    },
  );

/** Keeps what the user has answered so far in a waiting call's questions, sent with it if they're away. */
export function keepAnswers(
  ctx: HostContext,
  toolCallId: string,
  answers: QuestionAnswer[],
) {
  for (const agent of ctx.agents.values()) {
    const ask = agent.approvals.get(toolCallId);
    if (!ask) continue;
    ask.draft = answers;
    userBack(agent, true);
  }
}

/** Settles a waiting tool call with the user's answer. */
export function answerApproval(
  ctx: HostContext,
  toolCallId: string,
  approved: boolean,
  answers?: QuestionAnswer[],
  always?: boolean,
) {
  for (const agent of ctx.agents.values()) {
    const ask = agent.approvals.get(toolCallId);
    if (!ask) continue;
    agent.approvals.delete(toolCallId);
    unmarkWaiting(agent.id, toolCallId);
    userBack(agent);
    if (!approved) {
      ask.declined?.();
      // Declining to run a sandbox-blocked command outside it isn't feedback on the agent.
      if (ask.wait !== "ran" && own(agent, toolCallId))
        noteDenied(agent, toolCallId);
    }
    ask.answer(approved, answers, always);
    pushProjects(ctx);
    timeAway(ctx, agent);
  }
}

export const WROTE_INSTEAD =
  "The user didn't let this run: they wrote to you instead, and their message follows. Read it before going on.";

// pi lists a call as running before it asks, so a waiting call it doesn't list is a subagent's.
const own = (agent: Agent, toolCallId: string) =>
  agent.toolRuns.has(toolCallId);

/** Whether the conversation's own run (not a subagent) waits on the user. */
export const waitsOnUser = (agent: Agent) =>
  [...agent.approvals.keys()].some((id) => own(agent, id));

/** Denies a conversation's waiting tool calls: its run stopped, it closed, or the user `wrote` a message instead. */
export function denyAll(ctx: HostContext, agent: Agent, wrote = false) {
  if (!agent.approvals.size) return;
  agent.approvals.forEach((ask, id) => {
    const instead = wrote && own(agent, id);
    // Declining to run a sandbox-blocked command outside it isn't feedback on the agent.
    if (instead && ask.wait !== "ran") noteDenied(agent, id, true);
    ask.answer(
      false,
      undefined,
      undefined,
      instead ? WROTE_INSTEAD : undefined,
    );
  });
  agent.approvals.clear();
  forgetWaiting(agent.id);
  pushProjects(ctx);
  timeAway(ctx, agent);
}
