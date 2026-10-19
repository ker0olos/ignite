import type { TerminalRequest } from "../shared/terminal.ts";
import type { HostContext } from "./hostTypes.ts";
import { sep } from "node:path";
import { endTerminal, openTerminal, terminalsStartedIn } from "./terminal.ts";

type Open = Extract<TerminalRequest, { type: "terminal_open" }>;

// Worktrees being removed: a terminal asked for in one starts in its folder.
const removing = new Set<string>();
const beingRemoved = (dir: string) =>
  [...removing].some((r) => dir === r || dir.startsWith(r + sep));

/**
 * Ends the terminals started in `dir` (a worktree about to be removed),
 * telling the app, and waits a few seconds for them to let go of it; none
 * starts there again until the returned `removed` is called.
 */
export async function closeTerminalsIn(dir: string) {
  removing.add(dir);
  await Promise.all(terminalsStartedIn(dir).map(endTerminal));
  return () => void removing.delete(dir);
}

/** Where a terminal opened for conversation `id` starts: its worktree, waiting until it's made, else `fallback`. */
export async function terminalDir(
  ctx: HostContext,
  id: string | undefined,
  fallback: string,
) {
  const agent = id === undefined ? undefined : ctx.agents.get(id);
  if (!agent) return fallback;
  await agent.placed;
  return agent.workdir;
}

/** `terminal_open`: the user's shell in the conversation's worktree (once it's open), listed under its folder. */
export async function terminalOpen(ctx: HostContext, r: Open) {
  const dir = await terminalDir(ctx, r.session, r.dir ?? r.cwd);
  const at = beingRemoved(dir) ? r.cwd : dir;
  return openTerminal(r.cwd, r.cols, r.rows, ctx.send, at);
}
