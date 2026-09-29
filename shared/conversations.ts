/** A folder's saved conversations, as the history search lists and describes them. */
import type { SessionSummary } from "./memory.ts";

/** A conversation pi saved for a folder. */
export type SavedSession = {
  id: string;
  /** Its name, or else its first message. */
  title: string;
  /** Milliseconds since the epoch. */
  modified: number;
  messageCount: number;
  /** Whether it's open in this window. */
  open: boolean;
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
