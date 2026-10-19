import { randomUUID } from "node:crypto";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import type { AgentMessage } from "../shared/agentTypes.ts";
import { describeSession } from "../shared/describeSession.ts";
import { typedMessage } from "../shared/sentComments.ts";
import type { HostContext, SessionStore } from "./hostTypes.ts";

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

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

/** A new conversation's id: the app's, which names files so must be a UUID no conversation has, else a fresh one. */
export function newId(ctx: HostContext, session?: string) {
  if (session === undefined) return ctx.sessions.create();
  if (!UUID.test(session) || ctx.agents.has(session))
    throw new Error("A new conversation needs an unused UUID.");
  return session;
}

/** About the last `n` messages (all by default), never starting on a tool result cut off from its call. */
export function lastMessages(messages: AgentMessage[], n = Infinity) {
  let from = Math.max(0, messages.length - n);
  while (from > 0 && messages[from].role === "toolResult") from--;
  return messages.slice(from);
}

/** A conversation's messages (its last `tail`); a running one's own are newer than its file's. */
export const messagesOf = async (
  ctx: HostContext,
  cwd: string,
  session: string,
  tail?: number,
) =>
  lastMessages(
    ctx.agents.get(session)?.session?.messages ??
      (await ctx.sessions.read(cwd, session)),
    tail,
  );

/** What a conversation was doing, for the command center: its latest messages and plan. */
export async function sessionDetails(
  ctx: HostContext,
  cwd: string,
  session: string,
) {
  const [messages, tasks] = await Promise.all([
    messagesOf(ctx, cwd, session),
    ctx.tasks.list(cwd).catch(() => []),
  ]);
  const details = describeSession(messages);
  // Compaction drops the messages that laid out the plan; its task keeps it.
  const task = tasks.find((t) => t.session === session);
  return task ? { ...details, subtasks: task.subtasks } : details;
}

/** pi's saved conversations, one file each under the agent dir's sessions/. */
export const sessions: SessionStore = {
  create: () => randomUUID(),
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
        title: s.name ?? typedMessage(s.firstMessage),
        modified: s.modified.getTime(),
        messageCount: s.messageCount,
        text: s.allMessagesText,
      })),
};
