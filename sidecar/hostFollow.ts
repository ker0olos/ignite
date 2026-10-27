import type { AgentMessage, SessionEvent } from "../shared/agentTypes.ts";
import { titleOf } from "../shared/conversations.ts";
import { followSubagents } from "./hostChildren.ts";
import { followUserMessage } from "./hostCheckpoint.ts";
import { followRun, rememberRun } from "./hostMemory.ts";
import { pushProjects, trackRun } from "./hostProjects.ts";
import { sendNext } from "./hostQueue.ts";
import { reflectOn } from "./hostReflect.ts";
import { pushQueue } from "./nextQueue.ts";
import { reload, tellsApp, type Agent, type HostContext } from "./hostTypes.ts";
import { delivered } from "./queuedImages.ts";
import { trackToolRun } from "./toolRuns.ts";
import { describeError, toWireEvent } from "./wire.ts";
import { startReady } from "./worktreeReady.ts";

// The app keeps each conversation it opened current, so showing it again needs nothing from here.
/** Follows one of `agent`'s session events. */
export function follow(ctx: HostContext, agent: Agent, event: SessionEvent) {
  // pi's queue leaves out the held Next messages.
  if (event.type === "queue_update") return pushQueue(ctx, agent);
  if (tellsApp(ctx, agent)) {
    ctx.send({
      type: "session_event",
      session: agent.id,
      event: toWireEvent(event),
    });
  }
  trackToolRun(agent, event);
  followRun(agent, event);
  followUserMessage(ctx, agent, event);
  const subagentsChanged = followSubagents(agent, event);
  if (trackRun(agent, event) || subagentsChanged) pushProjects(ctx);
  if (event.type === "message_start") messageStarted(ctx, agent, event.message);
  if (event.type === "agent_settled") settle(ctx, agent);
}

function messageStarted(ctx: HostContext, agent: Agent, message: AgentMessage) {
  delivered(agent, message);
  // Claude Code has started by then; see worktreeReady.ts.
  if (message.role === "assistant") startReady(agent.workdir);
  // The first message names the conversation; pi stores it only afterwards.
  if (!agent.title && message.role === "user") {
    agent.title = titleOf(message);
    pushProjects(ctx);
  }
}

function settle(ctx: HostContext, agent: Agent) {
  if (!agent.session?.pendingMessageCount) agent.queuedImages.clear();
  // Before rememberRun, which clears the run's start.
  void reflectOn(agent, { sessions: ctx.sessions });
  agent.remembering = rememberRun(agent).catch(() => {});
  const report = reportTo(ctx, agent);
  const reloaded = agent.reloadWhenSettled
    ? reload(agent, ctx.trust).catch(report)
    : undefined;
  agent.reloadWhenSettled = false;
  // Nothing carried the run on before it settled; a Next message runs on the reloaded session.
  void Promise.resolve(reloaded)
    .then(() => sendNext(ctx, agent))
    .catch(report);
}

/** Shows a run's failure in its conversation, if the app follows it. */
export function reportTo(ctx: HostContext, agent: Agent) {
  return (error: unknown) => {
    if (!tellsApp(ctx, agent)) return;
    ctx.send({
      type: "session_error",
      session: agent.id,
      error: describeError(error),
    });
  };
}
