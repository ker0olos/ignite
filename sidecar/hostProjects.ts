import type { HostContext } from "./hostTypes.ts";

/** Tells the app which open folders are working or waiting. */
export function pushProjects(ctx: HostContext) {
  const projects = [...ctx.projects].map(([cwd, p]) => ({
    cwd,
    running: p.running,
    waiting: p.approvals.size > 0,
  }));
  ctx.send({ type: "projects", projects });
  void ctx.keepAwake(projects.some((p) => p.running && !p.waiting));
}
