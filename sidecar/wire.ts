import type { SessionEvent } from "../shared/agentTypes.ts";

/**
 * pi's documented wire form of a session event (docs/json.md): message_update
 * drops the cumulative message and partial snapshots, so each update carries
 * only its delta.
 */
export function toWireEvent(event: SessionEvent): SessionEvent {
  if (event.type !== "message_update") return event;
  const update: Record<string, unknown> = { ...event.assistantMessageEvent };
  const wire: Record<string, unknown> = {
    ...event,
    assistantMessageEvent: update,
  };
  delete wire.message;
  delete update.partial;
  return wire as SessionEvent;
}

/** Turns pi's errors into sentences for the connect screen. */
export function describeError(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  if (code === "EADDRINUSE") {
    return "Another app is using the sign-in port. Close other sign-ins (pi, Claude Code) and try again.";
  }
  return error instanceof Error ? error.message : String(error);
}
