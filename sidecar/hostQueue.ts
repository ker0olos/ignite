import type { ImageContent } from "../shared/agentTypes.ts";
import type { QueueKind, QueuedMessage, Unqueue } from "../shared/queue.ts";
import {
  current,
  target,
  type Agent,
  type HostContext,
  type Session,
} from "./hostTypes.ts";
import { cancelWaits } from "./backgroundBash.ts";
import { withSummaryProgress } from "./compactProgress.ts";
import { denyAll } from "./hostApproval.ts";
import { prompt } from "./hostSession.ts";
import { judgeQueued } from "./queueJudge.ts";
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

const message = ({ text, images }: QueuedMessage): QueuedMessage => ({
  text,
  ...(images && { images }),
});

/** Stops the run, taking back what's queued so it isn't sent with the next prompt. */
export async function stop(ctx: HostContext, session?: string) {
  const agent = target(ctx, session);
  const s = await current(ctx, session);
  if (agent) {
    denyAll(ctx, agent);
    cancelWaits(agent.id);
    dropJudging(agent);
  }
  const routing = agent?.routing;
  routing?.controller.abort();
  const queued = agent ? take(s, agent) : [];
  await s.abort();
  // The message being routed was never sent, so it comes back with the queue.
  return [...(routing ? [routing] : []), ...queued].map(message);
}

async function hasCredentials(s: Session) {
  if (!s.model) return false;
  const found = await s.modelRuntime.getAuth(s.model).catch(() => undefined);
  return !!(found?.auth.apiKey || found?.auth.headers);
}

/** Compacts the conversation, reporting the summary's progress; refused mid-run. Failures show through its compaction_end event. */
export async function compact(
  ctx: HostContext,
  session?: string,
  instructions?: string,
) {
  const agent = target(ctx, session);
  const s = await current(ctx, session);
  // pi's compact() would stop the run; the agent's work shouldn't end that way.
  if (s.isStreaming) {
    throw new Error(
      "The agent is working. Wait for it or stop it, then compact.",
    );
  }
  const run = () => s.compact(instructions || undefined);
  // Wrapping the stream function makes pi skip its own credentials check, so only wrap when they resolve.
  if (!(await hasCredentials(s))) return void (await run().catch(() => {}));
  const progress = (tokens: number) =>
    agent &&
    ctx.send({
      type: "session_event",
      session: agent.id,
      event: { type: "compaction_progress", tokens },
    });
  await withSummaryProgress(s.agent, progress, run).catch(() => {});
}

const edits = new WeakMap<Agent, Promise<unknown>>();

// Each edit empties pi's queues and fills them again, so one runs at a time.
function editQueue<T>(agent: Agent, edit: () => Promise<T>): Promise<T> {
  const next = (edits.get(agent) ?? Promise.resolve()).then(edit, edit);
  edits.set(
    agent,
    next.catch(() => {}),
  );
  return next;
}

// Finds the message, edits it in place or takes it out, and queues the rest again.
function edit(
  s: Session,
  agent: Agent,
  { kind, text, action }: Omit<Unqueue, "session">,
) {
  return editQueue(agent, async () => {
    const queued = take(s, agent);
    const i = queued.findIndex((q) => q.kind === kind && q.text === text);
    const found = queued[i];
    if (action === "up") swapUp(queued, i);
    else if (action === "switch") switchKind(queued, i);
    else if (found) queued.splice(i, 1);
    await requeue(s, agent, queued);
    return found;
  });
}

/** Holds the queue's edits from when the last one ends until `release`, while pi queues a new message. */
export function holdQueue(agent: Agent): Promise<() => void> {
  let release = () => {};
  const held = new Promise<void>((r) => (release = r));
  return new Promise((start) => {
    void editQueue(agent, () => {
      start(release);
      return held;
    });
  });
}

const judging = new WeakMap<Agent, Map<string, AbortController>>();

// Stop drops every judgment; the user acting on a message drops its own, so the judge never overrides them.
function dropJudging(agent: Agent, text?: string) {
  const pending = judging.get(agent);
  for (const [t, controller] of pending ?? []) {
    if (text === undefined || t === text) controller.abort();
  }
}

/** Moves follow-up `text` to the steering queue when the judge reads it as about the work in progress. */
export async function judgeFollowUp(
  s: Session,
  agent: Agent,
  text: string,
  images?: ImageContent[],
) {
  const pending = judging.get(agent) ?? new Map<string, AbortController>();
  judging.set(agent, pending);
  const controller = new AbortController();
  pending.get(text)?.abort();
  pending.set(text, controller);
  const kind = await judgeQueued(s, text, images, controller.signal);
  if (pending.get(text) === controller) pending.delete(text);
  if (kind !== "steer" || controller.signal.aborted || agent.closed) return;
  await edit(s, agent, { kind: "followUp", text, action: "switch" });
}

/** Takes one queued message back, moves it up, switches its kind or sends it now (see Unqueue). */
export async function unqueue(
  ctx: HostContext,
  { session, ...change }: Unqueue,
): Promise<QueuedMessage | null> {
  const agent = target(ctx, session)!;
  const s = await current(ctx, session);
  dropJudging(agent, change.text);
  const taken = await edit(s, agent, change);
  if (!taken) return null;
  const { action } = change;
  if (action === "now") {
    denyAll(ctx, agent, true);
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

// pi delivers every steer before any follow-up: a new steer goes last of them, a new follow-up first.
function switchKind(queued: Queued[], i: number) {
  if (i < 0) return;
  const kind = queued[i].kind === "steer" ? "followUp" : "steer";
  queued[i] = { ...queued[i], kind };
  queued.sort(
    (a, b) => Number(a.kind !== "steer") - Number(b.kind !== "steer"),
  );
}

// Awaited in turn, so they keep their order and are queued before any abort.
// steer/followUp only queue, so a run that just ended doesn't start one per message.
async function requeue(s: Session, agent: Agent, queued: Queued[]) {
  for (const q of queued) {
    rememberImages(agent, q.text, q.images);
    await (q.kind === "steer" ? s.steer : s.followUp).call(s, q.text, q.images);
  }
}
