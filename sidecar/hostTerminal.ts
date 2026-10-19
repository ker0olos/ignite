import { sep } from "node:path";
import type { TerminalRequest } from "../shared/terminal.ts";
import type { Agent, HostContext } from "./hostTypes.ts";
import { endTerminal, openTerminal, terminalsStartedIn } from "./terminal.ts";

type Open = Extract<TerminalRequest, { type: "terminal_open" }>;

// Worktrees being removed: a terminal asked for in one starts in its folder.
const removing = new Set<string>();
const beingRemoved = (dir: string) =>
  [...removing].some((r) => dir === r || dir.startsWith(r + sep));

/** Ends the terminals started in `dir` (a worktree about to go), waiting for them; none starts there until `removed()`. */
export async function closeTerminalsIn(dir: string) {
  removing.add(dir);
  await Promise.all(terminalsStartedIn(dir).map(endTerminal));
  return () => void removing.delete(dir);
}

/** Saves and removes a conversation's worktree, ending the terminals in it first. */
export async function releaseWorkspace(ctx: HostContext, agent: Agent) {
  const removed =
    agent.workdir !== agent.cwd
      ? await closeTerminalsIn(agent.workdir)
      : undefined;
  await ctx.workspaces.close(agent.cwd, agent.id).catch(() => {});
  removed?.();
}

/** Where a terminal for `session` of `cwd` starts: its worktree, once made; none yet (null): `fallback`; unknown (undefined): the shown one's. */
export async function terminalDir(
  ctx: HostContext,
  cwd: string,
  session: string | null | undefined,
  fallback: string,
) {
  const id = session === undefined ? ctx.shown : session;
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
