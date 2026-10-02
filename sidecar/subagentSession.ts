/** A subagent's pi session: talking to it, and ending it. */
import type { AgentSession } from "@earendil-works/pi-coding-agent";
import type { AgentMessage, AssistantMessage } from "../shared/agentTypes.ts";
import type { SubagentDetails } from "../shared/subagents.ts";

/** A started subagent; `busy` counts calls using it, so it isn't ended under them. */
export type Agent = Omit<SubagentDetails, "messages" | "running"> & {
  opening: Promise<AgentSession>;
  session?: AgentSession;
  busy: number;
};

/** Ends a subagent's session, if it opened. */
export async function end(opening: Promise<AgentSession>) {
  const session = await opening.catch(() => null);
  if (!session) return;
  await session.extensionRunner.emit({
    type: "session_shutdown",
    reason: "quit",
  });
  session.dispose();
}

const replyOf = (messages: AgentMessage[]) => {
  const last = messages.findLast((m) => m.role === "assistant") as
    AssistantMessage | undefined;
  if (!last) return "(no reply)";
  if (last.stopReason === "error") return `It failed: ${last.errorMessage}`;
  const text = last.content.flatMap((b) => (b.type === "text" ? [b.text] : []));
  return text.join("\n") || "(no reply)";
};

/** Sends the subagent a message and waits for its reply, reporting progress. */
export async function talk(
  agent: Agent,
  message: string,
  signal: AbortSignal | undefined,
  onUpdate:
    ((result: { content: []; details: SubagentDetails }) => void) | undefined,
) {
  const session = await agent.opening;
  // Stopped while it opened: its abort listener isn't on yet.
  if (signal?.aborted) throw new Error("Stopped.");
  if (session.isStreaming)
    throw new Error(`${agent.id} is still busy with another message.`);
  const from = session.messages.length;
  const details = (running: boolean): SubagentDetails => ({
    id: agent.id,
    model: agent.model,
    effort: agent.effort,
    messages: session.messages.slice(from) as AgentMessage[],
    running,
  });
  const unsubscribe = session.subscribe((event) => {
    if (event.type === "message_end" || event.type === "tool_execution_end") {
      onUpdate?.({ content: [], details: details(true) });
    }
  });
  const stop = () => void session.abort();
  signal?.addEventListener("abort", stop);
  try {
    await session.prompt(message);
  } finally {
    unsubscribe();
    signal?.removeEventListener("abort", stop);
  }
  const done = details(false);
  const text = `${agent.id} replied:\n\n${replyOf(done.messages)}`;
  return { content: [{ type: "text" as const, text }], details: done };
}
