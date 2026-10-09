import { titleOf } from "../shared/conversations.ts";
import type { OpenedSession } from "../shared/hostProtocol.ts";
import { dropFork, forkSession, noteFor } from "./forks.ts";
import { open } from "./hostSession.ts";
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
      "It has your context up to now and a copy of your files, and works separately; a summary of its work is added here after each of its runs.",
  );
  return opened;
}
