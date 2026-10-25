import type { QueueKind, QueuedMessage, Unqueue } from "../shared/queue.ts";
import {
  current,
  target,
  type Agent,
  type HostContext,
  type Session,
} from "./hostTypes.ts";
import { backgroundOf, cancelWaits } from "./backgroundBash.ts";
import { withSummaryProgress } from "./compactProgress.ts";
import { denyAll } from "./hostApproval.ts";
import { prompt } from "./hostSession.ts";
import { editQueue, held, pushQueue, quietly } from "./nextQueue.ts";
import { judgeQueued } from "./queueJudge.ts";
import { rememberImages, takeImages } from "./queuedImages.ts";

type Queued = QueuedMessage & { kind: QueueKind };
// `switch` is the judge's alone: a Next message it reads as a steer.
type Change = Omit<Unqueue, "session" | "action"> & {
  action?: Unqueue["action"] | "switch";
};

// Empties pi's queues and the held Next messages, in delivery order (steering first).
function take(s: Session, agent: Agent): Queued[] {
  const { steering, followUp } = s.clearQueue();
  const withImages = (kind: QueueKind) => (text: string) => {
    const images = takeImages(agent, text);
    return { text, kind, ...(images && { images }) };
  };
  return [
    ...steering.map(withImages("steer")),
    ...followUp.map(withImages("followUp")),
    ...held(agent)
      .splice(0)
      .map((m) => ({ ...m, kind: "followUp" as const })),
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
  const queued = agent ? await quietly(ctx, agent, () => take(s, agent)) : [];
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

// Finds the message, edits it in place or takes it out, and queues the rest
// again; only `when` it's still due once the edits before it are done.
function edit(
  ctx: HostContext,
  s: Session,
  agent: Agent,
  { kind, text, action }: Change,
  when = () => true,
) {
  return editQueue(agent, () =>
    quietly(ctx, agent, async () => {
      if (!when()) return undefined;
      const queued = take(s, agent);
      const i = queued.findIndex((q) => q.kind === kind && q.text === text);
      const taken = queued[i];
      if (action === "up") swapUp(queued, i);
      else if (action === "switch") switchKind(queued, i);
      else if (taken) queued.splice(i, 1);
      await requeue(s, agent, queued);
      return taken;
    }),
  );
}

/** Holds the queue's edits from when the last one ends until `release`, while pi queues a new message. */
export function holdQueue(agent: Agent): Promise<() => void> {
  let release = () => {};
  const done = new Promise<void>((r) => (release = r));
  return new Promise((start) => {
    void editQueue(agent, () => {
      start(release);
      return done;
    });
  });
}

/** Holds a Next message until the run has really ended, judging meanwhile whether it steers instead. */
export async function holdNext(
  ctx: HostContext,
  s: Session,
  agent: Agent,
  next: QueuedMessage,
) {
  await editQueue(agent, async () => held(agent).push(message(next)));
  pushQueue(ctx, agent);
  // The run may have settled while it waited for the queue; not awaited, as it takes the next turn.
  if (!agent.running) return void sendNext(ctx, agent).catch(() => {});
  void judgeNext(ctx, s, agent, next).catch(() => {});
}

// The run has really ended: nothing carried it on, no bash_wait is still to wake it,
// and it didn't fail (the next message would fail the same way; the user retries).
function ended(agent: Agent) {
  const s = agent.session;
  if (!s || agent.closed || agent.failed || agent.routing) return false;
  if (agent.running || s.isStreaming) return false;
  return !backgroundOf(agent.id).some((b) => b.wake);
}

/** Sends the first Next message once the run has really ended. */
export async function sendNext(ctx: HostContext, agent: Agent) {
  if (!held(agent).length || !ended(agent)) return;
  const next = await editQueue(agent, async () => held(agent).shift());
  if (!next) return;
  pushQueue(ctx, agent);
  // A run that started meanwhile holds it again; refused (a fork open), it waits for the next run's end.
  const { text, images } = next;
  await prompt(ctx, text, images, agent.id, undefined, "followUp").catch(
    (error) => {
      held(agent).unshift(next);
      pushQueue(ctx, agent);
      throw error;
    },
  );
}

const judging = new WeakMap<Agent, Map<string, AbortController>>();

// Stop drops every judgment; the user acting on a message drops its own, so the judge never overrides them.
function dropJudging(agent: Agent, text?: string) {
  const pending = judging.get(agent);
  for (const [t, controller] of pending ?? []) {
    if (text === undefined || t === text) controller.abort();
  }
}

// Moves the Next message to the steering queue when the judge reads it as about the work in progress.
async function judgeNext(
  ctx: HostContext,
  s: Session,
  agent: Agent,
  { text, images }: QueuedMessage,
) {
  const pending = judging.get(agent) ?? new Map<string, AbortController>();
  judging.set(agent, pending);
  const controller = new AbortController();
  pending.get(text)?.abort();
  pending.set(text, controller);
  const kind = await judgeQueued(s, text, images, controller.signal);
  if (pending.get(text) === controller) pending.delete(text);
  if (kind !== "steer" || controller.signal.aborted || agent.closed) return;
  // Once the run has ended, a steer would wait for the next one: it goes as Next.
  const change = { kind: "followUp" as const, text, action: "switch" as const };
  await edit(ctx, s, agent, change, () => s.isStreaming);
}

/** Takes one queued message back, moves it up or sends it now (see Unqueue). */
export async function unqueue(
  ctx: HostContext,
  { session, ...change }: Unqueue,
): Promise<QueuedMessage | null> {
  const agent = target(ctx, session)!;
  const s = await current(ctx, session);
  dropJudging(agent, change.text);
  const taken = await edit(ctx, s, agent, change);
  if (!taken) return null;
  if (change.action === "now") {
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

// Every steer goes before any Next: a new steer goes last of them, a new Next first.
function switchKind(queued: Queued[], i: number) {
  if (i < 0) return;
  const kind = queued[i].kind === "steer" ? "followUp" : "steer";
  queued[i] = { ...queued[i], kind };
  queued.sort(
    (a, b) => Number(a.kind !== "steer") - Number(b.kind !== "steer"),
  );
}

// Steers go back to pi, awaited in turn so they keep their order and are queued
// before any abort; follow-ups (pi's own too) wait here as Next messages.
async function requeue(s: Session, agent: Agent, queued: Queued[]) {
  for (const q of queued) {
    if (q.kind === "followUp") {
      held(agent).push(message(q));
      continue;
    }
    await s.steer(q.text, q.images);
    // pi keeps it as it expanded it (a skill's text, say).
    rememberImages(agent, s.getSteeringMessages().at(-1) ?? q.text, q.images);
  }
}
