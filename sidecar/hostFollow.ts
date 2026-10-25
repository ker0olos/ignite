import type { SessionEvent } from "../shared/agentTypes.ts";
import { titleOf } from "../shared/conversations.ts";
import { followSubagents } from "./hostChildren.ts";
import { followUserMessage } from "./hostCheckpoint.ts";
import { followRun, rememberRun } from "./hostMemory.ts";
import { pushProjects, trackRun } from "./hostProjects.ts";
import { reflectOn } from "./hostReflect.ts";
import { reload, tellsApp, type Agent, type HostContext } from "./hostTypes.ts";
import { delivered } from "./queuedImages.ts";
import { trackToolRun } from "./toolRuns.ts";
import { describeError, toWireEvent } from "./wire.ts";
import { startReady } from "./worktreeReady.ts";

// The app keeps each conversation it opened current, so showing it again needs nothing from here.
/** Follows one of `agent`'s session events. */
export function follow(ctx: HostContext, agent: Agent, event: SessionEvent) {
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
  if (event.type === "message_start") {
    delivered(agent, event.message);
    // Claude Code has started by then; see worktreeReady.ts.
    if (event.message.role === "assistant") startReady(agent.workdir);
  }
  // The first message names the conversation; pi stores it only afterwards.
  const first = event.type === "message_start" && !agent.title;
  if (first && event.message.role === "user") {
    agent.title = titleOf(event.message);
    pushProjects(ctx);
  }
  if (event.type === "agent_settled") settle(ctx, agent);
}

function settle(ctx: HostContext, agent: Agent) {
  if (!agent.session?.pendingMessageCount) agent.queuedImages.clear();
  // Before rememberRun, which clears the run's start.
  void reflectOn(agent);
  agent.remembering = rememberRun(agent).catch(() => {});
  if (!agent.reloadWhenSettled) return;
  agent.reloadWhenSettled = false;
  reload(agent, ctx.trust).catch(reportTo(ctx, agent));
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
