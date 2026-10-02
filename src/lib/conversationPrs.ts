import type {
  AgentMessage,
  AssistantMessage,
  ToolCall,
  ToolResult,
  ToolResultMessage,
} from "../../shared/agentTypes";
import { GH_TOOL } from "../../shared/git";
import { prUrl } from "../../shared/tasks";
import type { Transcript } from "@/lib/transcript";

export type PullRequest = { url: string; number: number };

function textOf(result: ToolResult | undefined): string {
  return (result?.content ?? [])
    .flatMap((b) => (b.type === "text" ? [b.text] : []))
    .join("\n");
}

function opensPr(call: ToolCall): boolean {
  const args = call.arguments.args;
  return (
    call.name === GH_TOOL &&
    Array.isArray(args) &&
    args[0] === "pr" &&
    args[1] === "create"
  );
}

function createCalls(messages: AgentMessage[]): ToolCall[] {
  return messages
    .filter((m): m is AssistantMessage => m.role === "assistant")
    .flatMap((m) => m.content)
    .filter((b): b is ToolCall => b.type === "toolCall" && opensPr(b));
}

/** The pull requests the conversation opened with `gh pr create`, in order. */
export function conversationPrs(transcript: Transcript): PullRequest[] {
  const messages = transcript.items.flatMap((i) =>
    i.kind === "message" ? [i.message] : [],
  );
  const results = new Map(
    messages
      .filter((m): m is ToolResultMessage => m.role === "toolResult")
      .map((m) => [m.toolCallId, m]),
  );
  const urls = createCalls(messages).map((c) =>
    prUrl(textOf(results.get(c.id) ?? transcript.tools[c.id]?.result)),
  );
  return [...new Set(urls)].flatMap((url) =>
    url ? [{ url, number: Number(url.split("/").pop()) }] : [],
  );
}
