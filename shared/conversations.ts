/** A folder's saved conversations, as the command center finds, lists and describes them. */
import type { SessionSummary } from "./memory.ts";

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
