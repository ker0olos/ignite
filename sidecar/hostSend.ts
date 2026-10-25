import type { ImageContent } from "../shared/agentTypes.ts";
import type { QueueKind } from "../shared/queue.ts";
import { denyAll, waitsOnUser, WROTE_INSTEAD } from "./hostApproval.ts";
import { checkpointFirst } from "./hostCheckpoint.ts";
import { reportTo } from "./hostFollow.ts";
import { holdNext, holdQueue } from "./hostQueue.ts";
import { routeMessage } from "./hostRoute.ts";
import type { Agent, HostContext, Session } from "./hostTypes.ts";
import { rememberImages } from "./queuedImages.ts";

/** A message written before a cut-off run resumed goes first; one written after waits until that run has started. */
export async function settleResume(agent: Agent) {
  const { resume } = agent;
  if (!resume) return;
  agent.resume = undefined;
  // The app holds the rewound conversation; reopening sends it the restored one.
  if (await resume.cancel(WROTE_INSTEAD)) agent.followed = false;
  else await resume.started;
}

export type Outgoing = {
  text: string;
  images?: ImageContent[];
  queue: QueueKind;
  onError?: (error: unknown) => void;
};

// pi only marks a run active once it holds the message, so each message waits for the one before.
export function takeTurn(agent: Agent) {
  const before = agent.sending;
  let done = () => {};
  agent.sending = new Promise<void>((resolve) => (done = resolve));
  return { before, done };
}

/** Gives pi the message; false when the router dropped it. `done` once pi holds it or it failed. */
export async function hand(
  ctx: HostContext,
  agent: Agent,
  s: Session,
  { text, images, queue, onError }: Outgoing,
  done: () => void,
) {
  await settleResume(agent);
  const streaming = s.isStreaming;
  // A message written instead of answering says why, so it steers even when queued.
  const behavior = waitsOnUser(agent) ? "steer" : queue;
  if (waitsAsNext(s, behavior, text)) {
    await holdNext(ctx, s, agent, { text, images });
    done();
    return true;
  }
  // A message sent mid-run steers the run; others may be routed (hostRoute.ts).
  if (!streaming) {
    if (!(await routeMessage(ctx, agent, s, text, images))) return false;
    await checkpointFirst(agent);
  }
  const release = streaming ? await holdQueue(agent) : () => {};
  const settled = () => {
    release();
    done();
  };
  const options = {
    ...(s.isStreaming && { streamingBehavior: behavior }),
    ...(images?.length ? { images } : {}),
    // Writing instead of answering declines what waits, once pi holds the
    // message: declined earlier, the run's next turn starts without it.
    preflightResult: (result?: string) => {
      denyAll(ctx, agent, true);
      // Run as a command, it starts no message to take the snapshot.
      if (result === "handled") agent.snapshot = undefined;
      // pi has just queued it last, as it expanded it (a skill's text, say), while the queue's edits are held.
      if (result === "queued")
        rememberImages(agent, lastQueued(s, behavior), images);
      settled();
    },
  };
  const failed = onError ?? reportTo(ctx, agent);
  s.prompt(text, options).then(settled, (error: unknown) => {
    agent.snapshot = undefined;
    settled();
    failed(error);
  });
  return true;
}

// A follow-up lands in pi's own queue only when its run started while the message was routed.
function lastQueued(s: Session, behavior: QueueKind) {
  const queue =
    behavior === "steer" ? s.getSteeringMessages() : s.getFollowUpMessages();
  return queue.at(-1)!;
}

// A follow-up sent mid-run waits as Next (nextQueue.ts); pi runs a command at once, even mid-run.
function waitsAsNext(s: Session, behavior: QueueKind, text: string) {
  if (!s.isStreaming || behavior !== "followUp") return false;
  const command = text.startsWith("/") && text.slice(1).split(" ")[0];
  return !command || !s.extensionRunner.getCommand(command);
}
