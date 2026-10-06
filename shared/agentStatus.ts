/** A conversation's status as the sidebar shows it, and what runs under it: its subagents and background commands. */
import type { ApprovalRequest } from "./hostProtocol.ts";

/** One of a folder's open conversations, which may be working while another is shown. */
export type AgentStatus = {
  cwd: string;
  session: string;
  /** The first line of its first message; empty until it has one. */
  title: string;
  running: boolean;
  /** Its last run ended in an error. */
  failed?: boolean;
  /** A tool call waits for the user. */
  waiting: boolean;
  /** The pull request waiting for the user's review, if one is. */
  review?: ApprovalRequest;
} & ChildRuns;

/** A conversation's subagent, as the sidebar lists it. */
export type SubagentStatus = { id: string; model: string; running: boolean };

/** A bash command a conversation left running in the background, or that has since ended. */
type BackgroundStatus = {
  pid: number;
  command: string;
  running: boolean;
};

/** A background command's latest output (the end of it, when long). */
export type BackgroundOutput = {
  command: string;
  running: boolean;
  exitCode?: number;
  output: string;
  truncated: boolean;
};

/** What runs under a conversation; each list is left out until it has one. */
export type ChildRuns = {
  subagents?: SubagentStatus[];
  /** Bash commands it left running in the background. */
  background?: BackgroundStatus[];
};

export type ChildRequest =
  /** A background command's output, by its conversation and pid. */
  | { id: number; type: "background_output"; session: string; pid: number }
  /** Stops a background command; false when it had already ended. */
  | { id: number; type: "background_stop"; session: string; pid: number }
  /** Ends a running bash call, the agent carrying on with its output so far; false when none runs. */
  | { id: number; type: "skip_wait"; toolCallId: string };

export type ChildResponses = {
  background_output: BackgroundOutput;
  background_stop: boolean;
  skip_wait: boolean;
};
