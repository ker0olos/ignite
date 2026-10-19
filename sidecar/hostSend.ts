import type { ImageContent } from "../shared/agentTypes.ts";
import type { QueueKind } from "../shared/queue.ts";
import { denyAll, waitsOnUser, WROTE_INSTEAD } from "./hostApproval.ts";
import { checkpointFirst } from "./hostCheckpoint.ts";
import { reportTo } from "./hostFollow.ts";
import { revive } from "./hostFree.ts";
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
  await revive(ctx, agent);
  await agent.ready;
  if (s.isStreaming) rememberImages(agent, text, images);
  // A message sent mid-run steers the run; a conversation's first one may be routed.
  else if (!(await routeMessage(ctx, agent, s, text, images))) return false;
  else await checkpointFirst(agent);
  // A message written instead of answering says why, so it steers even when queued.
  const behavior = waitsOnUser(agent) ? "steer" : queue;
  const options = {
    ...(s.isStreaming && { streamingBehavior: behavior }),
    ...(images?.length ? { images } : {}),
    // Writing instead of answering declines what waits, once pi holds the
    // message: declined earlier, the run's next turn starts without it.
    preflightResult: (result?: string) => {
      denyAll(ctx, agent, true);
      // Run as a command, it starts no message to take the snapshot.
      if (result === "handled") agent.snapshot = undefined;
      done();
    },
  };
  const failed = onError ?? reportTo(ctx, agent);
  s.prompt(text, options).then(done, (error: unknown) => {
    agent.snapshot = undefined;
    done();
    failed(error);
  });
  return true;
}
