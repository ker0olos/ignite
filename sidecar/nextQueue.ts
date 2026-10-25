/**
 * Next messages (sent mid-run to wait) are held here, not in pi's follow-up
 * queue, which pi hands over the moment the agent would stop: before the stop
 * nudge, a task's wrap-up or a bash_wait could carry the run on.
 */
import type { QueuedMessage } from "../shared/queue.ts";
import { tellsApp, type Agent, type HostContext } from "./hostTypes.ts";

const edits = new WeakMap<Agent, Promise<unknown>>();

/** Runs one edit of `agent`'s queues at a time: each empties them and fills them again. */
export function editQueue<T>(agent: Agent, edit: () => Promise<T>): Promise<T> {
  const next = (edits.get(agent) ?? Promise.resolve()).then(edit, edit);
  edits.set(
    agent,
    next.catch(() => {}),
  );
  return next;
}

/** `agent`'s Next messages, oldest first. */
export function held(agent: Agent): QueuedMessage[] {
  return (agent.next ??= []);
}

/** What waits, as the app lists it: pi's steers, then pi's own follow-ups and the held Next messages. */
export function queueOf(agent: Agent, s = agent.session) {
  return {
    steering: [...(s?.getSteeringMessages() ?? [])],
    followUp: [
      ...(s?.getFollowUpMessages() ?? []),
      ...held(agent).map((m) => m.text),
    ],
  };
}

const quiet = new WeakSet<Agent>();

/** Runs `edit` without telling the app the queues it passes through, only where they end up. */
export async function quietly<T>(
  ctx: HostContext,
  agent: Agent,
  edit: () => T | Promise<T>,
): Promise<T> {
  quiet.add(agent);
  try {
    return await edit();
  } finally {
    quiet.delete(agent);
    pushQueue(ctx, agent);
  }
}

/** Tells the app what waits now. */
export function pushQueue(ctx: HostContext, agent: Agent) {
  if (quiet.has(agent) || !tellsApp(ctx, agent)) return;
  ctx.send({
    type: "session_event",
    session: agent.id,
    event: { type: "queue_update", ...queueOf(agent) },
  });
}
