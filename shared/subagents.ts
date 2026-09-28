import type { AgentMessage } from "./agentTypes.ts";

/** The tool the main agent starts and talks to subagents with. */
export const SUBAGENT_TOOL = "subagent";

/** pi's effort levels, lowest first. */
export const EFFORTS = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;

/** A subagent tool call's details: who ran, and what it did during this call. */
export type SubagentDetails = {
  id: string;
  model: string;
  effort: string;
  messages: AgentMessage[];
  running: boolean;
};

/** Reads a subagent call's details, or undefined while it has none. */
export function readSubagent(details: unknown): SubagentDetails | undefined {
  const d = details as Partial<SubagentDetails> | undefined;
  return d && typeof d.id === "string" && Array.isArray(d.messages)
    ? (d as SubagentDetails)
    : undefined;
}
