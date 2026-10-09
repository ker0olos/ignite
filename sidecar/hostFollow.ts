import type { SessionEvent } from "../shared/agentTypes.ts";
import { titleOf } from "../shared/conversations.ts";
import { reportFork } from "./forks.ts";
import { followSubagents } from "./hostChildren.ts";
import { pushProjects, trackRun } from "./hostProjects.ts";
import { isShown, type Agent, type HostContext } from "./hostTypes.ts";
import { delivered } from "./queuedImages.ts";
import { trackToolRun } from "./toolRuns.ts";
import { describeError, toWireEvent } from "./wire.ts";

// Only the shown conversation's events reach the app; the rest keep running unseen.
/** Follows one of `agent`'s session events. */
export function follow(ctx: HostContext, agent: Agent, event: SessionEvent) {
  if (isShown(ctx, agent)) {
    ctx.send({
      type: "session_event",
      session: agent.id,
      event: toWireEvent(event),
    });
  }
  trackToolRun(agent, event);
  const subagentsChanged = followSubagents(agent, event);
  if (trackRun(agent, event) || subagentsChanged) pushProjects(ctx);
  if (event.type === "message_start") delivered(agent, event.message);
  // The first message names the conversation; pi stores it only afterwards.
  const first = event.type === "message_start" && !agent.title;
  if (first && event.message.role === "user") {
    agent.title = titleOf(event.message);
    pushProjects(ctx);
  }
  if (event.type === "agent_settled") settle(ctx, agent);
}

function settle(ctx: HostContext, agent: Agent) {
  reportFork(agent).catch(() => {});
  if (!agent.session?.pendingMessageCount) agent.queuedImages.clear();
  if (!agent.reloadWhenSettled) return;
  agent.reloadWhenSettled = false;
  agent.session?.reload().catch(reportTo(ctx, agent));
}

/** Shows a run's failure, if its conversation is the one shown. */
export function reportTo(ctx: HostContext, agent: Agent) {
  return (error: unknown) => {
    if (isShown(ctx, agent)) {
      ctx.send({
        type: "session_error",
        session: agent.id,
        error: describeError(error),
      });
    }
  };
}
