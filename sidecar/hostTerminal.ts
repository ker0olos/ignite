import { sep } from "node:path";
import type { TerminalRequest } from "../shared/terminal.ts";
import type { Agent, HostContext } from "./hostTypes.ts";
import { endTerminal, openTerminal, terminalsStartedIn } from "./terminal.ts";

type Open = Extract<TerminalRequest, { type: "terminal_open" }>;

// Worktrees being removed: a terminal asked for in one starts in its folder.
const removing = new Set<string>();
const beingRemoved = (dir: string) =>
  [...removing].some((r) => dir === r || dir.startsWith(r + sep));

/** Ends the terminals started in `dir` (a worktree about to go), waiting for them unless quitting; none starts there until `removed()`. */
export async function closeTerminalsIn(dir: string, wait = true) {
  removing.add(dir);
  const ending = terminalsStartedIn(dir).map(endTerminal);
  if (wait) await Promise.all(ending);
  return () => void removing.delete(dir);
}

/** Saves and removes a conversation's worktree, ending the terminals in it first, if it's removed (no other window uses it). */
export async function releaseWorkspace(
  ctx: HostContext,
  agent: Agent,
  quitting = false,
) {
  const { cwd, id, workdir } = agent;
  let removed: (() => void) | undefined;
  const closing =
    workdir === cwd
      ? ctx.workspaces.close(cwd, id)
      : ctx.workspaces.close(cwd, id, async () => {
          removed = await closeTerminalsIn(workdir, !quitting);
        });
  await closing.catch(() => {});
  removed?.();
}

// ponytail: polls for a conversation the app asked to open just before; an event would avoid the wait.
async function registered(ctx: HostContext, id: string) {
  for (let i = 0; i < 50 && !ctx.agents.has(id); i++)
    await new Promise((resolve) => setTimeout(resolve, 100));
  return ctx.agents.get(id);
}

/** Where a terminal for `session` of `cwd` starts: its worktree, once made; none yet (null): `fallback`; unknown (undefined): the shown one's. */
export async function terminalDir(
  ctx: HostContext,
  cwd: string,
  session: string | null | undefined,
  fallback: string,
) {
  const id = session === undefined ? ctx.shown : session;
  // One the app named may not be open yet (just shown after a relaunch).
  const agent =
    id === null
      ? undefined
      : session === undefined
        ? ctx.agents.get(id)
        : await registered(ctx, id);
  if (!agent || agent.cwd !== cwd) return fallback;
  await agent.placed;
  return agent.workdir;
}

/** `terminal_open`: the user's shell in the conversation's worktree, listed under its folder. */
export async function terminalOpen(ctx: HostContext, r: Open) {
  const dir = await terminalDir(ctx, r.cwd, r.session, r.dir ?? r.cwd);
  const at = beingRemoved(dir) ? r.cwd : dir;
  return openTerminal(r.cwd, r.cols, r.rows, ctx.send, at);
}

/** The app's requests about conversations' worktrees and the terminals in them. */
export const worktreeHandlers = {
  terminal_open: terminalOpen,
  worktree_layout: (ctx: HostContext, r: { cwd: string }) =>
    ctx.workspaces.layout(r.cwd),
  worktree_ready: async (ctx: HostContext, r: { session: string }) =>
    void (await ctx.agents.get(r.session)?.ready),
};
