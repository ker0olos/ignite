import { childrenOf } from "./hostChildren.ts";
import type { HostContext } from "./hostTypes.ts";

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
      running: a.running,
      waiting: a.approvals.size > 0,
      ...(review && { review }),
      ...childrenOf(a),
    };
  });
  ctx.send({ type: "agents", agents });
  void ctx.keepAwake(agents.some((a) => a.running && !a.waiting));
}
