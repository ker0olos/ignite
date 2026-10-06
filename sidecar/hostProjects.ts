import { childrenOf } from "./hostChildren.ts";
import type { SessionEvent } from "../shared/agentTypes.ts";
import type { Agent, HostContext } from "./hostTypes.ts";

/** Tells the app which open conversations are working or waiting. */
export function pushProjects(ctx: HostContext) {
  const agents = [...ctx.agents.values()].map((a) => {
    const review = [...a.approvals.values()]
      .map((ask) => ask.request)
      .find((r) => r.review?.kind === "pr");
    return {
      cwd: a.cwd,
      session: a.id,
      title: a.title,
      // Routing its first message counts as working, before pi's run starts.
      running: a.running || !!a.routing,
      ...(a.failed && { failed: true }),
      waiting: a.approvals.size > 0,
      ...(review && { review }),
      ...childrenOf(a),
    };
  });
  ctx.send({ type: "agents", agents });
  void ctx.keepAwake(agents.some((a) => a.running && !a.waiting));
}

/** Notes a run starting or settling, and whether it ended in an error; true when either changed. */
export function trackRun(agent: Agent, event: SessionEvent): boolean {
  if (event.type === "message_end" && event.message.role === "assistant")
    agent.failed =
      (event.message as { stopReason?: string }).stopReason === "error";
  if (event.type !== "agent_start" && event.type !== "agent_settled")
    return false;
  agent.running = event.type === "agent_start";
  return true;
}
