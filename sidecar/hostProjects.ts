import type { HostContext } from "./hostTypes.ts";

/** Tells the app which open conversations are working or waiting. */
export function pushProjects(ctx: HostContext) {
  const agents = [...ctx.agents.values()].map((a) => ({
    cwd: a.cwd,
    session: a.id,
    running: a.running,
    waiting: a.approvals.size > 0,
  }));
  ctx.send({ type: "agents", agents });
  void ctx.keepAwake(agents.some((a) => a.running && !a.waiting));
}
