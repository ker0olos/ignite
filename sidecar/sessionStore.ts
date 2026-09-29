import { randomUUID } from "node:crypto";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import type { AgentMessage } from "../shared/agentTypes.ts";
import type { SessionStore } from "./hostTypes.ts";
import { sessionSummary } from "./cmem.ts";
import { savedBranch } from "./worktrees.ts";

/**
 * Opens `folder`'s saved conversation `id`, or starts one with that id, for
 * an agent working in `workdir` (its worktree); it's kept with the folder's.
 */
export function sessionFor(folder: string, workdir: string, id: string) {
  const saved = SessionManager.findById(folder, id);
  if (saved) return SessionManager.open(saved, undefined, workdir);
  const dir = SessionManager.create(folder).getSessionDir();
  return SessionManager.create(workdir, dir, { id });
}

/** pi's saved conversations, one file each under the agent dir's sessions/. */
export const sessions: SessionStore = {
  create: () => randomUUID(),
  extras: async (cwd, id) => {
    const [branch, summary] = await Promise.all([
      savedBranch(cwd, id).catch(() => undefined),
      sessionSummary(cwd, id),
    ]);
    return { ...(branch && { branch }), ...(summary && { summary }) };
  },
  read: async (cwd, id) => {
    const saved = SessionManager.findById(cwd, id);
    if (!saved) return [];
    return SessionManager.open(saved, undefined, cwd).buildSessionContext()
      .messages as AgentMessage[];
  },
  list: async (cwd) =>
    (await SessionManager.list(cwd))
      .filter((s) => s.messageCount > 0)
      .map((s) => ({
        id: s.id,
        title: s.name ?? s.firstMessage,
        modified: s.modified.getTime(),
        messageCount: s.messageCount,
        text: s.allMessagesText,
      })),
};
