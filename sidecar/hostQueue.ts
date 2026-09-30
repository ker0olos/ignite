import type { QueueKind, QueuedMessage, Unqueue } from "../shared/queue.ts";
import {
  current,
  target,
  type Agent,
  type HostContext,
  type Session,
} from "./hostTypes.ts";
import { denyAll } from "./hostApproval.ts";
import { prompt } from "./hostSession.ts";
import { rememberImages, takeImages } from "./queuedImages.ts";

type Queued = QueuedMessage & { kind: QueueKind };

// Empties pi's queues, in delivery order (steering first).
function take(s: Session, agent: Agent): Queued[] {
  const { steering, followUp } = s.clearQueue();
  const withImages = (kind: QueueKind) => (text: string) => {
    const images = takeImages(agent, text);
    return { text, kind, ...(images && { images }) };
  };
  return [
    ...steering.map(withImages("steer")),
    ...followUp.map(withImages("followUp")),
  ];
}

const message = ({ text, images }: Queued): QueuedMessage => ({
  text,
  ...(images && { images }),
});

/** Stops the run, taking back what's queued so it isn't sent with the next prompt. */
export async function stop(ctx: HostContext, session?: string) {
  const agent = target(ctx, session);
  const s = await current(ctx, session);
  if (agent) denyAll(ctx, agent);
  const queued = agent ? take(s, agent) : [];
  await s.abort();
  return queued.map(message);
}

/** Takes one queued message back, moves it up or sends it now (see Unqueue). */
export async function unqueue(
  ctx: HostContext,
  { kind, text, action, session }: Unqueue,
): Promise<QueuedMessage | null> {
  const agent = target(ctx, session)!;
  const s = await current(ctx, session);
  const queued = take(s, agent);
  const i = queued.findIndex((q) => q.kind === kind && q.text === text);
  const taken = queued[i];
  if (action === "up") swapUp(queued, i);
  else if (taken) queued.splice(i, 1);
  await requeue(s, agent, queued);
  if (!taken) return null;
  if (action === "now") {
    denyAll(ctx, agent);
    await s.abort();
    await prompt(ctx, taken.text, taken.images, session);
  }
  return message(taken);
}

// Each place keeps its kind, so a message moved to the top becomes the next steer.
function swapUp(queued: Queued[], i: number) {
  if (i < 1) return;
  const [a, b] = [queued[i - 1], queued[i]];
  queued[i - 1] = { ...b, kind: a.kind };
  queued[i] = { ...a, kind: b.kind };
}

// Awaited in turn, so they keep their order and are queued before any abort.
// steer/followUp only queue, so a run that just ended doesn't start one per message.
async function requeue(s: Session, agent: Agent, queued: Queued[]) {
  for (const q of queued) {
    rememberImages(agent, q.text, q.images);
    await (q.kind === "steer" ? s.steer : s.followUp).call(s, q.text, q.images);
  }
}
