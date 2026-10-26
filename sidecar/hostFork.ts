import type { AgentMessage } from "../shared/agentTypes.ts";
import { titleOf } from "../shared/conversations.ts";
import type { OpenedSession } from "../shared/hostProtocol.ts";
import {
  detachFork,
  dropFork,
  dropNote,
  forkReport,
  forkSession,
  lastText,
  noteFor,
  summarize,
  unreported,
} from "./forks.ts";
import { heldBy, pushProjects, waitsOnFork } from "./hostProjects.ts";
import { close, launch, open, prompt, start } from "./hostSession.ts";
import type { Agent, HostContext } from "./hostTypes.ts";
import { release } from "./hostWait.ts";

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
  const to = ctx.sessions.create();
  const title = forkName(task, agent?.title);
  const entry = forkSession(folder, from, to, title, agent?.running);
  start(ctx, folder, to, {
    title,
    forkOf: from,
    files: async () => {
      // The message's checkpoint may still be being kept.
      await agent?.checkpoint;
      await ctx.workspaces.fork(folder, from, to, entry);
    },
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
  const upTo = agent?.running
    ? "up to the message you were working on, and a copy of your files"
    : "up to now and a copy of your files";
  noteFor(
    from,
    `The user forked this conversation into a new one (${to})${task ? ` to work on: ${task}` : ""}. ` +
      `It has your context ${upTo}, and works separately; you wait until the user closes it, then its report comes to you.`,
  );
  return opened;
}

/**
 * Stops conversation `id` waiting for its forks: open ones stay its forks but
 * send no report when closed, closed ones' reports come as notes, and it
 * carries on. False when nothing held it.
 */
export function stopWaiting(ctx: HostContext, id: string): boolean {
  const reports = ctx.agents.get(id)?.forkReports;
  const pending = reports?.size ?? 0;
  reports?.clear();
  const forks = heldBy(ctx, id);
  for (const fork of forks) {
    // Saved in its file, so it stays detached after a restart.
    if (fork.session) detachFork(fork.session.sessionManager);
    else void fork.opening.then((s) => detachFork(s.sessionManager));
    fork.forkDetached = true;
    noteFor(
      fork.id,
      `The user stopped conversation ${id} waiting for you: it carries on separately, and nothing is sent to it when you're closed.`,
    );
    noteFor(
      id,
      `The user stopped you waiting for your fork "${fork.title}" (${fork.id}): it works separately and sends you no report.`,
    );
  }
  if (!forks.length && !pending) return false;
  pushProjects(ctx);
  release(ctx, id);
  return true;
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
  if (!fork?.forkOf || fork.forkDetached) return close(ctx, folder, id);
  const messages = fork.session && unreported(fork.session)?.messages;
  if (messages) void report(ctx, fork, messages, hold(ctx, folder, fork));
  await close(ctx, folder, id);
  if (!messages) release(ctx, fork.forkOf);
}

// The original waits for the report. A closed one opens in the background
// (and closes with its folder), unless another fork still holds it.
function hold(ctx: HostContext, folder: string, fork: Agent) {
  const id = fork.forkOf!;
  const held = heldBy(ctx, id).some((a) => a !== fork);
  if (!held && !ctx.agents.has(id))
    void launch(ctx, folder, id).catch(() => {});
  const parent = ctx.agents.get(id) ?? null;
  if (parent) (parent.forkReports ??= new Set()).add(fork);
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
  // False once the user stopped it waiting: then the report is only a note.
  let awaited: boolean;
  try {
    summary = await summarize(
      await parent?.opening.catch(() => null),
      messages,
    );
  } finally {
    awaited = !!parent?.forkReports?.delete(fork);
    pushProjects(ctx);
  }
  if (draft) dropNote(to, draft);
  const text = reportText(fork, summary);
  if (text && carriesOn(ctx, parent, awaited))
    return prompt(ctx, text, undefined, parent.id);
  if (text) noteFor(to, text);
  release(ctx, to);
}

// Another fork still open keeps it waiting; then it reads the report next run.
const carriesOn = (
  ctx: HostContext,
  parent: Agent | null,
  awaited: boolean,
): parent is Agent =>
  awaited &&
  !!parent?.session &&
  ctx.agents.get(parent.id) === parent &&
  !waitsOnFork(ctx, parent.id);
