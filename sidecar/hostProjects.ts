import type { HostContext } from "./hostTypes.ts";

/** Tells the app which open folders are working or waiting. */
export function pushProjects(ctx: HostContext) {
  ctx.send({
    type: "projects",
    projects: [...ctx.projects].map(([cwd, p]) => ({
      cwd,
      running: p.running,
      waiting: p.approvals.size > 0,
    })),
  });
}
