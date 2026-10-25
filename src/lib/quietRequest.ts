import type { AgentMessage, AssistantMessage } from "../../shared/agentTypes";
import { limitHit } from "../../shared/fallbackKeys";

/** A request the model hasn't started answering: when it went out, and why it may take a while. */
export type QuietRequest = { since: number; reason: string };

/** How long a request goes unanswered before the working line says why. */
export const QUIET_MS = 10_000;

// Past this, reading the conversation alone noticeably delays the first token.
const LONG_CONTEXT = 100_000;

/** The run's request still waiting on the model's first token, or undefined while a reply streams or just ended. Pass only messages since the latest compaction. */
export function quietRequest(
  messages: AgentMessage[],
): QuietRequest | undefined {
  const last = messages.at(-1);
  if (last?.timestamp === undefined || !awaitsReply(last)) return undefined;
  return { since: last.timestamp, reason: reasonFor(messages) };
}

// A new request goes out after a user message or tool result; its reply may have started with nothing in it yet.
function awaitsReply(last: AgentMessage): boolean {
  if (last.role !== "assistant") return true;
  const reply = last as AssistantMessage;
  return reply.stopReason === "pending" && reply.content.length === 0;
}

function reasonFor(messages: AgentMessage[]): string {
  const tokens = contextTokens(messages);
  const size = `${Math.round(tokens / 1000)}k tokens`;
  const fresh = `The first request sends ${tokens > 0 ? `all ${size}` : "the whole conversation"} fresh, so it's slow to start.`;
  const [now, before] = latestReplies(messages);
  if (before && limitHit(before))
    return `Claude hit its limit, so this is on your API key now. ${fresh}`;
  if (now && before && switched(before, now))
    return `This is on ${onKey(before, now) ? "your API key" : now.model} now. ${fresh}`;
  if (tokens >= LONG_CONTEXT)
    return `Long conversation (${size}), so the model takes a while to read it.`;
  return "Still waiting on the model. It may be thinking, or just busy.";
}

// Another model or provider starts without the conversation's cache.
const switched = (before: AssistantMessage, now: AssistantMessage) =>
  now.provider !== before.provider || now.model !== before.model;

// The Claude subscription's model, now on a fallback key's provider.
const onKey = (before: AssistantMessage, now: AssistantMessage) =>
  before.provider === "claude-bridge" && now.provider === "anthropic";

/** The reply being waited on (when it has started) and the one before it. */
function latestReplies(
  messages: AgentMessage[],
): [AssistantMessage | undefined, AssistantMessage | undefined] {
  const replies = messages.filter(
    (m): m is AssistantMessage => m.role === "assistant",
  );
  const last = messages.at(-1);
  return last?.role === "assistant"
    ? [replies.at(-1), replies.at(-2)]
    : [undefined, replies.at(-1)];
}

/** The conversation's size as its latest answered request saw it. */
function contextTokens(messages: AgentMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    const usage = (messages[i] as AssistantMessage).usage;
    if (messages[i].role !== "assistant" || !usage) continue;
    const total =
      usage.input + usage.cacheRead + usage.cacheWrite + usage.output;
    if (total > 0) return total;
  }
  return 0;
}
