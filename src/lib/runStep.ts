import type { AgentMessage, AssistantMessage } from "../../shared/agentTypes";
import { stepOf } from "../../shared/steps";
import type { ToolRun, Transcript } from "@/lib/transcript";

/** The current run's latest assistant message: none before the last user message counts. */
function runReply(messages: AgentMessage[]): AssistantMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return undefined;
    if (messages[i].role === "assistant")
      return messages[i] as AssistantMessage;
  }
}

/** What the run is doing now: the latest unfinished tool call, thinking, or just working. */
export function currentStep(
  messages: AgentMessage[],
  tools: Record<string, ToolRun>,
  folder: string,
): string {
  const last = runReply(messages);
  if (!last) return "Working";
  const call = last.content.findLast(
    (b) =>
      b.type === "toolCall" &&
      (tools[b.id] === undefined || tools[b.id].status === "running"),
  );
  if (call?.type === "toolCall")
    return stepOf(call.name, call.arguments, folder) ?? "Working";
  return last.content.at(-1)?.type === "thinking" ? "Thinking" : "Working";
}

/** When the run began: the last user message's time. */
export function runStart(messages: AgentMessage[]): number | undefined {
  return messages.findLast((m) => m.role === "user")?.timestamp;
}

/** Elapsed milliseconds as "12s" or "1m 5s". */
export function elapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

// Only one line shows, so splitting the whole reasoning on every streamed token is wasted.
const TAIL_CHARS = 600;

/** The newest sentence of the reasoning the run is streaming now, if it's thinking. */
export function latestThought(messages: AgentMessage[]): string | undefined {
  const block = runReply(messages)?.content.at(-1);
  if (block?.type !== "thinking" || block.redacted) return undefined;
  const sentences = block.thinking
    .slice(-TAIL_CHARS)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return sentences.at(-1);
}

/** The working line's step, start and (when asked for) newest thought, or null when nothing runs or compaction shows its own progress; "Waiting for fork" while a fork of it is open. */
export function workingLine(
  t: Transcript,
  folder: string,
  withThought: boolean,
  waitingOnFork = false,
): WorkingLine | null {
  if (t.running) return runLine(t, folder, withThought);
  return waitingOnFork ? { step: "Waiting for fork" } : null;
}

type WorkingLine = { step: string; since?: number; thought?: string };

function runLine(
  t: Transcript,
  folder: string,
  withThought: boolean,
): WorkingLine | null {
  const last = t.items.at(-1);
  if (last?.kind === "compaction" && !last.summary) return null;
  const messages = t.items.flatMap((i) =>
    i.kind === "message" ? [i.message] : [],
  );
  const since = t.routedAt ?? runStart(messages);
  if (t.routing) return { step: "Routing…", since };
  return {
    step: currentStep(messages, t.tools, folder),
    since,
    thought: withThought ? latestThought(messages) : undefined,
  };
}
