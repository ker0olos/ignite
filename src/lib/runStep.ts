import type { AgentMessage, AssistantMessage } from "../../shared/agentTypes";
import { stepOf } from "../../shared/steps";
import type { ToolRun } from "@/lib/transcript";

/** What the run is doing now: the latest unfinished tool call, thinking, or just working. */
export function currentStep(
  messages: AgentMessage[],
  tools: Record<string, ToolRun>,
  folder: string,
): string {
  const last = messages.findLast((m) => m.role === "assistant") as
    AssistantMessage | undefined;
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
