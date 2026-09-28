import type {
  AgentMessage,
  AssistantMessage,
  ToolCall,
  ToolResultMessage,
} from "../shared/agentTypes.ts";
import type { Session } from "./hostTypes.ts";

const NOT_RUN =
  "Not run: the app reloaded while this was waiting or running. Call it again if it's still needed.";
const RESUME =
  "The app reloaded and cut off your last run. Continue from where you stopped.";

/**
 * Whether a saved conversation was cut off mid-run (the sidecar was killed by
 * a reload or quit), and the tool calls it left without results.
 */
export function cutOff(messages: AgentMessage[]): ToolCall[] | null {
  const last = messages.at(-1);
  if (last?.role === "user" || last?.role === "toolResult") return [];
  if (last?.role !== "assistant") return null;
  const { stopReason, content } = last as AssistantMessage;
  const calls = content.filter((c): c is ToolCall => c.type === "toolCall");
  return stopReason === "toolUse" && calls.length ? calls : null;
}

/** Records a cut-off run's pending calls as not run, then has the agent carry on. */
export async function resume(s: Session) {
  const calls = s.isStreaming ? null : cutOff(s.messages);
  if (!calls) return;
  const results = calls.map((call): ToolResultMessage => ({
    role: "toolResult",
    toolCallId: call.id,
    toolName: call.name,
    content: [{ type: "text", text: NOT_RUN }],
    isError: true,
    timestamp: Date.now(),
  }));
  for (const result of results) s.sessionManager.appendMessage(result);
  s.agent.state.messages = [...s.agent.state.messages, ...results];
  await s.sendCustomMessage(
    { customType: "ignition-resume", content: RESUME, display: false },
    { triggerTurn: true },
  );
}
