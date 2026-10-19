/** A delivered conversation's worktree, saved and removed as on closing while it's idle and hidden; made again when needed. */
import { backgroundOf } from "./backgroundBash.ts";
import { delivered } from "./gitStatus.ts";
import { releaseWorkspace } from "./hostTerminal.ts";
import {
  busy,
  isShown,
  reload,
  type Agent,
  type HostContext,
} from "./hostTypes.ts";
import { terminalsStartedIn } from "./terminal.ts";

// A background command that exited still wakes the agent with bash_wait.
const usesFiles = (agent: Agent) =>
  backgroundOf(agent.id).some((b) => b.running || b.wake) ||
  terminalsStartedIn(agent.workdir).length > 0;

// Open, in a worktree of its own, not shown, and nothing runs, waits to run, or uses its files.
function untouched(ctx: HostContext, agent: Agent) {
  const s = agent.session;
  if (!s || ctx.agents.get(agent.id) !== agent || agent.freed) return false;
  if (agent.workdir === agent.cwd || isShown(ctx, agent)) return false;
  return !busy(agent, s) && !agent.reloadWhenSettled && !usesFiles(agent);
}

/** Saves and removes the worktree of a conversation whose work is pushed, unless it's shown or anything uses it. */
export async function freeIfDelivered(ctx: HostContext, agent: Agent) {
  await agent.placed;
  // A cut-off run resuming (hostResume.ts) runs once begun, or never.
  await agent.resume?.started;
  // A message handed meanwhile is held by pi (it's running) once its turn settles.
  let sending;
  do {
    sending = agent.sending;
    await sending;
  } while (sending !== agent.sending);
  if (!untouched(ctx, agent)) return;
  if (!(await delivered(agent.session!.messages, agent.workdir))) return;
  // It may have been shown or sent a message while git was asked.
  if (agent.sending !== sending || !untouched(ctx, agent)) return;
  agent.freed = releaseWorkspace(ctx, agent, false, true);
}

/** Shows conversation `id` (null: none); the one shown before may free its worktree. */
export function showOnly(ctx: HostContext, id: string | null) {
  const was = ctx.shown === null ? undefined : ctx.agents.get(ctx.shown);
  ctx.shown = id;
  if (was && was.id !== id) freeIfDelivered(ctx, was).catch(() => {});
}

/** Makes a freed worktree again; settles once `workdir` exists, its ignored files following in `ready`. */
export function revive(ctx: HostContext, agent: Agent): Promise<void> {
  const freeing = agent.freed;
  if (!freeing) return agent.placed;
  agent.freed = undefined;
  agent.remade = (agent.remade ?? 0) + 1;
  agent.placed = freeing
    .then(() => ctx.workspaces.open(agent.cwd, agent.id))
    .then(
      async (ws) => {
        Object.assign(agent, { workdir: ws.dir, ready: ws.ready });
        if (!agent.reloadWhenSettled) return;
        agent.reloadWhenSettled = false;
        // Failing, it reloads after its next run instead.
        await reload(agent).catch(() => (agent.reloadWhenSettled = true));
      },
      (error: unknown) => {
        // The next message or showing tries again.
        agent.freed = Promise.resolve();
        throw error;
      },
    );
  return agent.placed;
}
