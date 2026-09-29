import type { AgentMessage, ToolCall } from "../shared/agentTypes.ts";
import type { SessionDetails } from "../shared/conversations.ts";

const REPLY_LENGTH = 400;
const MAX_FILES = 12;
const EDITING = new Set(["edit", "write"]);

type Reply = {
  role: "assistant";
  model?: string;
  content: ({ type: string; text?: string } | ToolCall)[];
  usage?: { cost?: { total?: number } };
};

const isReply = (m: AgentMessage): m is Reply & AgentMessage =>
  m.role === "assistant";

// A file shows from the folder: an agent in a worktree names it by its path
// there, whose part after the worktree reads like the user's own.
const shown = (path: string, folder: string) => {
  const inWorktree = path.replace(
    /^.*\/\.[^/]+\/worktrees\/[^/]+\/[^/]+\//,
    "",
  );
  if (inWorktree !== path) return inWorktree;
  return path.startsWith(`${folder}/`) ? path.slice(folder.length + 1) : path;
};

/**
 * What a conversation in `folder` tells about itself: model, last reply,
 * files edited (from the folder), tool calls, cost.
 */
export function describeSession(
  messages: AgentMessage[],
  folder: string,
): Omit<SessionDetails, "branch" | "summary"> {
  const replies = messages.filter(isReply);
  const calls = replies.flatMap((r) =>
    r.content.filter((c): c is ToolCall => c.type === "toolCall"),
  );
  const files = calls
    .filter((c) => EDITING.has(c.name) && typeof c.arguments.path === "string")
    .map((c) => shown(c.arguments.path as string, folder))
    .reverse();
  const cost = replies.reduce((sum, r) => sum + (r.usage?.cost?.total ?? 0), 0);
  const last = replies.at(-1);
  const reply = last?.content
    .map((c) => (c.type === "text" ? (c as { text?: string }).text : ""))
    .join("")
    .trim();
  return {
    ...(last?.model && { model: last.model }),
    ...(reply && { lastReply: reply.slice(0, REPLY_LENGTH) }),
    files: [...new Set(files)].slice(0, MAX_FILES),
    toolCalls: calls.length,
    ...(cost > 0 && { cost }),
  };
}
