/** Running a cut-off message again (hostResume.ts): the model's answer replayed, some of its calls blocked. */
import {
  createAssistantMessageEventStream,
  type AssistantMessage as PiMessage,
} from "@earendil-works/pi-ai";
import type { AgentMessage, AssistantMessage } from "../shared/agentTypes.ts";
import type { StreamFn } from "./compactProgress.ts";
import type { Session } from "./hostTypes.ts";

const textOf = (m: { content?: unknown }) =>
  typeof m.content === "string"
    ? m.content
    : Array.isArray(m.content)
      ? m.content.map((c: { text?: string }) => c.text ?? "").join("")
      : "";

/** Whether the model call's context ends with the resume `note` (it follows the last assistant message). */
function endsWithNote(messages: AgentMessage[], note: string) {
  const at = messages.findLastIndex((m) => m.role === "assistant");
  return messages.slice(at + 1).some((m) => textOf(m as object) === note);
}

/** Answers the first model call after `note` with `message`, so its tool calls run through the usual hooks. */
export function replayOnce(
  s: Session,
  message: AssistantMessage,
  note: string,
) {
  const stream = s.agent.streamFunction;
  s.agent.streamFunction = ((...args: never[]) => {
    const [, context] = args as unknown as [
      unknown,
      { messages: AgentMessage[] },
    ];
    // Never a compaction's summary call, which has no note of its own.
    if (!endsWithNote(context.messages, note)) {
      return (stream as (...a: never[]) => unknown)(...args);
    }
    s.agent.streamFunction = stream;
    const out = createAssistantMessageEventStream();
    const replayed = { ...message, timestamp: Date.now() } as PiMessage;
    out.push({ type: "start", partial: replayed });
    out.push({ type: "done", reason: "toolUse", message: replayed });
    return out;
  }) as StreamFn;
  return () => {
    if (s.agent.streamFunction !== stream) s.agent.streamFunction = stream;
  };
}

/** Blocks the replayed calls `blocked` names, with its text as their result. */
export function blockOnce(s: Session, blocked: Map<string, string>) {
  const before = s.agent.beforeToolCall;
  s.agent.beforeToolCall = async (context, signal) => {
    const reason = blocked.get(context.toolCall.id);
    if (reason === undefined) return before?.(context, signal);
    blocked.delete(context.toolCall.id);
    return { block: true, reason };
  };
  return () => (s.agent.beforeToolCall = before);
}
