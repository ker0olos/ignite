import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type Call = { type: string; id?: string; name?: string; arguments?: unknown };

const WAIT = /^\s*sleep\s+[\d.]+[smhd]?\s*(?:$|;|&&)/;

function isWait(call: Call) {
  const command = (call.arguments as { command?: unknown } | undefined)
    ?.command;
  return (
    call.name === "bash" && typeof command === "string" && WAIT.test(command)
  );
}

/** The wait sent before this call in the same message, which pi would run alongside it. */
export function waitBefore(calls: Call[], id: string): string | undefined {
  const tools = calls.filter((c) => c.type === "toolCall");
  const at = tools.findIndex((c) => c.id === id);
  const wait = tools.slice(0, Math.max(at, 0)).find(isWait);
  return (wait?.arguments as { command: string } | undefined)?.command;
}

/** Refuses calls sent in the same message as an earlier `sleep`: pi runs them in parallel, before it ends. */
export default function waitFirst(pi: ExtensionAPI) {
  let calls: Call[] = [];
  pi.on("message_end", (event) => {
    if (event.message.role === "assistant")
      calls = event.message.content as Call[];
  });
  pi.on("tool_call", (event) => {
    const wait = waitBefore(calls, event.toolCallId);
    if (!wait) return;
    return {
      block: true,
      reason: `Not run: calls in one message run at the same time, so this would have run before \`${wait}\` ended. Make it again, in a message of its own, once the wait is over.`,
    };
  });
}
