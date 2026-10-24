import type { TerminalRequest } from "../shared/terminal.ts";
import type { Agent, HostContext } from "./hostTypes.ts";
import { endTerminal, openTerminal, terminalsStartedIn } from "./terminal.ts";
import { within } from "./worktreeGit.ts";
import { whenReady } from "./worktreeReady.ts";

type Open = Extract<TerminalRequest, { type: "terminal_open" }>;

// Worktrees being removed: a terminal asked for in one starts in its folder.
const removing = new Set<string>();
const beingRemoved = (dir: string) => [...removing].some((r) => within(dir, r));

/** Ends the terminals started in `dir` (a worktree about to go); none starts there until `removed()`. */
export async function closeTerminalsIn(dir: string) {
  removing.add(dir);
  // One failing to end never leaves the worktree marked as being removed.
  await Promise.allSettled(terminalsStartedIn(dir).map(endTerminal));
  return () => void removing.delete(dir);
}

/** Saves and removes conversation `id`'s worktree, ending the terminals in it first, if it's removed (no other window uses it). */
export async function releaseWorkspace(
  ctx: HostContext,
  cwd: string,
  id: string,
) {
  let removed: (() => void) | undefined;
  await ctx.workspaces
    .close(cwd, id, async (path) => {
      removed = await closeTerminalsIn(path);
    })
    .catch(() => {});
  removed?.();
}

/** Ends the terminals in a quitting conversation's worktree and what they started, without waiting; the worktree stays. */
export function endTerminalsIn(agent: Agent) {
  if (agent.workdir === agent.cwd) return;
  for (const id of terminalsStartedIn(agent.workdir)) void endTerminal(id);
}

/** Where a terminal for `session` of `cwd` starts: its worktree, once made; none yet (null): `fallback`; unknown (undefined): the shown one's. */
export async function terminalDir(
  ctx: HostContext,
  cwd: string,
  session: string | null | undefined,
  fallback: string,
) {
  const id = session === undefined ? ctx.shown : session;
  // The app asks to open a conversation before it shows it, so one it names here is already registered.
  const agent = id === null ? undefined : ctx.agents.get(id);
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
  worktree_ready: async (ctx: HostContext, r: { session: string }) => {
    const agent = ctx.agents.get(r.session);
    if (!agent) return;
    await agent.placed;
    await whenReady(agent.workdir);
  },
};
