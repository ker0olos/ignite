import type { ApprovalAsk } from "./approvalExtension.ts";
import type { HostContext, Project } from "./hostTypes.ts";
import { pushProjects } from "./hostProjects.ts";

/** Keeps a tool call's question, and passes it on if its folder is shown. */
export function askApproval(
  ctx: HostContext,
  cwd: string,
  project: Project,
  ask: ApprovalAsk,
) {
  project.approvals.set(ask.request.toolCallId, ask);
  if (ctx.cwd === cwd) {
    ctx.send({ type: "approval_request", request: ask.request });
  }
  pushProjects(ctx);
}

/** Settles a waiting tool call with the user's answer. */
export function answerApproval(
  ctx: HostContext,
  toolCallId: string,
  approved: boolean,
) {
  for (const project of ctx.projects.values()) {
    const ask = project.approvals.get(toolCallId);
    if (!ask) continue;
    project.approvals.delete(toolCallId);
    ask.answer(approved);
    pushProjects(ctx);
  }
}

/** Denies a project's waiting tool calls: its run stopped or it closed. */
export function denyAll(ctx: HostContext, project: Project) {
  if (!project.approvals.size) return;
  project.approvals.forEach((ask) => ask.answer(false));
  project.approvals.clear();
  pushProjects(ctx);
}
