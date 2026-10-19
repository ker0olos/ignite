import { fileURLToPath } from "node:url";

// Resolved, not joined, so they're found (or overridden) from a modded copy.
const sibling = (name: string) => fileURLToPath(import.meta.resolve(name));

// Runs Claude through the user's own Claude Code (Agent SDK), which Anthropic
// bills to the Claude plan; pi's direct Claude sign-in draws extra usage.
export const claudeBridge = sibling("pi-claude-bridge/src/index.ts");
// pi-mcp-adapter, reading only agentDir/mcp.json.
export const mcpExtension = sibling("./mcpExtension.ts");
const exploring = sibling("./exploreExtension.ts");
const webSearch = sibling("./webSearchExtension.ts");
const waitFirst = sibling("./waitFirstExtension.ts");
// Before approval, so a call a lesson blocks never asks.
const lessons = sibling("./lessonExtension.ts");
// After the extensions that block calls, so a refused call never waits first.
const ready = sibling("./readyExtension.ts");
// Last, so it judges tool calls as the other extensions left them.
const approval = sibling("./approvalExtension.ts");

/** A conversation's extensions, in load order. */
export const SESSION_EXTENSIONS = [
  claudeBridge,
  mcpExtension,
  sibling("./memoryExtension.ts"),
  sibling("./askExtension.ts"),
  sibling("./subagentExtension.ts"),
  sibling("./gitExtension.ts"),
  sibling("./worktreeExtension.ts"),
  sibling("./chromeExtension.ts"),
  webSearch,
  sibling("./adbExtension.ts"),
  sibling("./imageExtension.ts"),
  sibling("./artifactExtension.ts"),
  sibling("./bashExtension.ts"),
  sibling("./terminalExtension.ts"),
  sibling("./forkExtension.ts"),
  exploring,
  waitFirst,
  lessons,
  sibling("./taskExtension.ts"),
  ready,
  approval,
  // After approval: snapshots only calls that will run, and sees a rerun outside the sandbox.
  sibling("./shellEditsExtension.ts"),
];

/** A subagent's extensions, in load order. */
export const SUBAGENT_EXTENSIONS = [
  claudeBridge,
  webSearch,
  exploring,
  waitFirst,
  lessons,
  ready,
  approval,
];
