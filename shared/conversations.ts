/** A folder's saved conversations, as the command center finds, lists and describes them. */
import type { AgentMessage, UserMessage } from "./agentTypes.ts";
import type { SessionSummary } from "./memory.ts";
import { typedSkill } from "./skills.ts";

/** A conversation pi saved for a folder. */
export type SavedSession = {
  id: string;
  /** Its name, or else its first message. */
  title: string;
  /** Milliseconds since the epoch. */
  modified: number;
  messageCount: number;
};

/** What a saved conversation did, for the history search. */
export type SessionDetails = {
  /** The model of its last reply. */
  model?: string;
  /** Its last reply, shortened. */
  lastReply?: string;
  /** Files it edited or wrote, the latest first. */
  files: string[];
  toolCalls: number;
  /** In dollars, when the provider reports it. */
  cost?: number;
  /** The branch its worktree was on. */
  branch?: string;
  /** cmem's summary of its latest run, when cmem recorded it. */
  summary?: SessionSummary;
};

/** A saved conversation the command center found, in `folder`. */
export type ConversationHit = SavedSession & {
  folder: string;
  /** Where its text matched, when not in its title. */
  snippet?: string;
};

/** A file the command center found: `path` is relative to `folder`. */
export type FileHit = { folder: string; path: string };

/**
 * A new conversation copied, files included, from the folder's `session`,
 * which gets a summary of the fork's work after each of its runs. `task`,
 * the fork's first message, is only for the original's note.
 */
export type ForkSession = { session: string; task?: string };

/** The command center's search: the best matches in `folders`, of `kinds`. */
export type CommandSearch = {
  text: string;
  folders: string[];
  kinds: ("conversation" | "file")[];
  limit: number;
};

export type CommandSearchResult = {
  conversations: ConversationHit[];
  files: FileHit[];
};

const TITLE_LENGTH = 80;

const isUser = (m: AgentMessage): m is UserMessage => m.role === "user";

/** A user message as a title: its first line of text, or "". */
export function titleOf(message: AgentMessage | undefined): string {
  const content = message && isUser(message) ? message.content : undefined;
  const text =
    typeof content === "string"
      ? content
      : content?.find((c) => c.type === "text")?.text;
  return typedSkill((text ?? "").trim())
    .split("\n")[0]
    .slice(0, TITLE_LENGTH);
}

/** A conversation's title: its first user message, as the history lists it, or "" before one. */
export const firstTitle = (messages: AgentMessage[]) =>
  titleOf(messages.find(isUser));
