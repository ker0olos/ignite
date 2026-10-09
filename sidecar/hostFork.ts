import type { AgentMessage } from "../shared/agentTypes.ts";
import { titleOf } from "../shared/conversations.ts";
import type { OpenedSession } from "../shared/hostProtocol.ts";
import {
  dropFork,
  forkSession,
  noteFor,
  summarize,
  unreported,
} from "./forks.ts";
import { pushProjects, waitsOnFork } from "./hostProjects.ts";
import { close, open, prompt } from "./hostSession.ts";
import type { Agent, HostContext } from "./hostTypes.ts";

// Mid-run, the copy would end on tool calls that never get results.
const busy = (agent: Agent) =>
  agent.running || !!agent.routing || !!agent.session?.pendingMessageCount;

const forkName = (task?: string, title?: string) =>
  task
    ? titleOf({ role: "user", content: task, timestamp: 0 })
    : `Fork of ${title || "a conversation"}`;

/**
 * Forks `folder`'s conversation `from` into a new one, files included, tells
 * the original, and shows the fork. `task`, its first message, is for that note.
 */
export async function fork(
  ctx: HostContext,
  folder: string,
  from: string,
  task?: string,
): Promise<OpenedSession> {
  const agent = ctx.agents.get(from);
  if (agent && busy(agent))
    throw new Error(
      "Wait for this conversation's run to end, or stop it, before forking it.",
    );
  const to = ctx.sessions.create();
  forkSession(folder, from, to, forkName(task, agent?.title));
  let opened: OpenedSession;
  try {
    await ctx.workspaces.fork(folder, from, to);
    opened = (await open(ctx, folder, to))!;
  } catch (error) {
    dropFork(folder, to);
    throw error;
  }
  noteFor(
    from,
    `The user forked this conversation into a new one (${to})${task ? ` to work on: ${task}` : ""}. ` +
      "It has your context up to now and a copy of your files, and works separately; you wait until the user closes it, then its report comes to you.",
  );
  return opened;
}

/**
 * Ends conversation `id`, or all of `folder`'s. A fork's work since its last
 * report goes to its original, which carries on from it (or reads it next
 * run, when it isn't open).
 */
export async function closeConversation(
  ctx: HostContext,
  folder: string,
  id?: string,
) {
  const fork = id === undefined ? undefined : ctx.agents.get(id);
  if (!fork?.forkOf) return close(ctx, folder, id);
  const found = fork.session && unreported(fork.session);
  const parent = ctx.agents.get(fork.forkOf) ?? null;
  if (parent) parent.forkReports = (parent.forkReports ?? 0) + 1;
  await close(ctx, folder, id);
  void report(ctx, fork, found?.messages, parent);
}

async function report(
  ctx: HostContext,
  fork: Agent,
  messages: AgentMessage[] | undefined,
  parent: Agent | null,
) {
  let summary = "";
  try {
    if (messages) summary = await summarize(parent?.session, messages);
  } finally {
    if (parent) parent.forkReports! -= 1;
    pushProjects(ctx);
  }
  if (!summary) return;
  const text = `Your fork "${fork.title}" (${fork.id}) is done. Its report:\n\n${summary}`;
  // Another fork still open keeps it waiting; then it reads this next run.
  const carriesOn =
    parent?.session &&
    ctx.agents.get(parent.id) === parent &&
    !waitsOnFork(ctx, parent.id);
  if (carriesOn) await prompt(ctx, text, undefined, parent.id);
  else noteFor(fork.forkOf!, text);
}
