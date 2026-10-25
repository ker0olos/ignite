import type { ImageContent } from "./agentTypes.ts";

/**
 * How a message sent mid-run waits: `steer` goes in after the current tool
 * call, `followUp` once the run would otherwise end.
 */
export type QueueKind = "steer" | "followUp";

/** A queued message taken back from pi. */
export type QueuedMessage = { text: string; images?: ImageContent[] };

/**
 * Takes a queued message back, or with `action` keeps it: `up` swaps it with
 * the one before (each place keeps its kind), `now` stops the run and sends it.
 */
export type Unqueue = {
  kind: QueueKind;
  text: string;
  action?: "up" | "now";
  session?: string;
};
