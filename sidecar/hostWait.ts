/** Wakes conversations whose bash_wait commands exited: a hidden message that starts a run. */
import { exitedWaits, onBackgroundChange } from "./backgroundBash.ts";
import { groupExitedText } from "./bashWait.ts";
import { noteFor, takeNotes } from "./forks.ts";
import { pushProjects, waitsOnFork } from "./hostProjects.ts";
import { sendNext } from "./hostQueue.ts";
import type { HostContext } from "./hostTypes.ts";

/** Pushes the sidebar and wakes conversations as background commands start and end; returns the unsubscribe. */
export const watchBackground = (ctx: HostContext) =>
  onBackgroundChange(() => {
    pushProjects(ctx);
    const woken = wakeWaiting(ctx);
    // A bash_wait dropped with no run to wake (its command stopped) leaves Next messages free to go.
    for (const agent of ctx.agents.values()) {
      if (!woken.has(agent.id)) void sendNext(ctx, agent).catch(() => {});
    }
  });

/** Tells each conversation about the commands it waits on that have exited; returns the conversations woken. */
export function wakeWaiting(ctx: HostContext) {
  const woken = new Set<string>();
  for (const group of exitedWaits()) {
    const id = group[0].session;
    woken.add(id);
    void groupExitedText(group).then((content) => wake(ctx, id, content));
  }
  return woken;
}

/** Carries conversation `id` on once no fork holds it: the exits it was told of meanwhile, else its Next messages. */
export function release(ctx: HostContext, id: string) {
  const agent = ctx.agents.get(id);
  if (!agent || waitsOnFork(ctx, id)) return;
  const notes = agent.wakeOwed ? takeNotes(id) : [];
  agent.wakeOwed = false;
  if (notes.length) return void wake(ctx, id, notes.join("\n\n---\n\n"));
  void sendNext(ctx, agent).catch(() => {});
}

function wake(ctx: HostContext, id: string, content: string) {
  const agent = ctx.agents.get(id);
  if (agent?.session && !waitsOnFork(ctx, id)) {
    return agent.session
      .sendCustomMessage(
        { customType: "background-exit", content, display: false },
        { triggerTurn: true, deliverAs: "followUp" },
      )
      .catch(() => noteFor(id, content));
  }
  // One waiting on its fork takes no messages; it reads this once released, or with its next run.
  if (agent) agent.wakeOwed = true;
  noteFor(id, content);
}
