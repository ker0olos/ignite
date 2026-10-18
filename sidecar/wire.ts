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
  // The wire form names the tool call that starts, which only `partial` has.
  if (update.type === "toolcall_start") {
    const { partial, contentIndex } =
      event.assistantMessageEvent as unknown as {
        partial?: { content?: { id?: string; name?: string }[] };
        contentIndex: number;
      };
    const block = partial?.content?.[contentIndex];
    update.id = block?.id;
    update.toolName = block?.name;
  }
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

const reason = (stderr: string, prefix: string) =>
  stderr.match(new RegExp(`^${prefix}: (.+?)[;:.]?$`, "m"))?.[1];

/** A failed git command's reason from its stderr (Node's message is its whole argument list); else describeError's. */
export function commandReason(error: unknown): string {
  const stderr = (error as { stderr?: unknown } | null)?.stderr;
  if (typeof stderr !== "string" || !stderr.trim()) return describeError(error);
  return (
    reason(stderr, "fatal") ??
    reason(stderr, "error") ??
    stderr.trim().split("\n").at(-1)!
  );
}
