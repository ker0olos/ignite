import type { AgentMessage } from "../shared/agentTypes.ts";
import { titleOf } from "../shared/conversations.ts";
import type { OpenedSession } from "../shared/hostProtocol.ts";
import {
  dropFork,
  dropNote,
  forkReport,
  forkSession,
  lastText,
  noteFor,
  summarize,
  unreported,
} from "./forks.ts";
import { pushProjects, waitsOnFork } from "./hostProjects.ts";
import { close, launch, open, prompt, start } from "./hostSession.ts";
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
  const title = forkName(task, agent?.title);
  forkSession(folder, from, to, title);
  start(ctx, folder, to, {
    title,
    forkOf: from,
    files: () => ctx.workspaces.fork(folder, from, to),
  });
  let opened: OpenedSession;
  try {
    opened = (await open(ctx, folder, to))!;
  } catch (error) {
    unfork(ctx, folder, from, to);
    throw error;
  }
  // Closed while its files were copied: the original isn't waiting on it.
  if (!ctx.agents.has(to)) throw new Error("The fork was closed as it opened.");
  noteFor(
    from,
    `The user forked this conversation into a new one (${to})${task ? ` to work on: ${task}` : ""}. ` +
      "It has your context up to now and a copy of your files, and works separately; you wait until the user closes it, then its report comes to you.",
  );
  return opened;
}

// The app listed the fork as it started; the original shows again.
function unfork(ctx: HostContext, folder: string, from: string, to: string) {
  dropFork(folder, to);
  if (ctx.shown === to) ctx.shown = from;
  if (ctx.lastShown.get(folder) === to) ctx.lastShown.set(folder, from);
  ctx.send({ type: "conversation_dropped", cwd: folder, session: to });
}

/**
 * Ends conversation `id`, or all of `folder`'s. A fork's work since its last
 * report goes to its original, opened if need be, which carries on from it
 * (or reads it next run, while another fork holds it).
 */
export async function closeConversation(
  ctx: HostContext,
  folder: string,
  id?: string,
) {
  const fork = id === undefined ? undefined : ctx.agents.get(id);
  if (!fork?.forkOf) return close(ctx, folder, id);
  const messages = fork.session && unreported(fork.session)?.messages;
  if (messages) void report(ctx, fork, messages, hold(ctx, folder, fork));
  await close(ctx, folder, id);
}

// The original waits for the report. A closed one opens in the background
// (and closes with its folder), unless another fork still holds it.
function hold(ctx: HostContext, folder: string, fork: Agent) {
  const id = fork.forkOf!;
  const held = [...ctx.agents.values()].some(
    (a) => a !== fork && a.forkOf === id,
  );
  if (!held && !ctx.agents.has(id))
    void launch(ctx, folder, id).catch(() => {});
  const parent = ctx.agents.get(id) ?? null;
  if (parent) parent.forkReports = (parent.forkReports ?? 0) + 1;
  return parent;
}

const reportText = (fork: Agent, summary: string) =>
  summary && forkReport(fork.title, fork.id, summary);

async function report(
  ctx: HostContext,
  fork: Agent,
  messages: AgentMessage[],
  parent: Agent | null,
) {
  const to = fork.forkOf!;
  // Kept until the summary replaces it, in case the sidecar ends first.
  const draft = reportText(fork, lastText(messages));
  if (draft) noteFor(to, draft);
  let summary: string;
  try {
    summary = await summarize(
      await parent?.opening.catch(() => null),
      messages,
    );
  } finally {
    if (parent) parent.forkReports! -= 1;
    pushProjects(ctx);
  }
  if (draft) dropNote(to, draft);
  const text = reportText(fork, summary);
  if (!text) return;
  // Another fork still open keeps it waiting; then it reads this next run.
  const carriesOn =
    parent?.session &&
    ctx.agents.get(parent.id) === parent &&
    !waitsOnFork(ctx, parent.id);
  if (carriesOn) await prompt(ctx, text, undefined, parent.id);
  else noteFor(to, text);
}
