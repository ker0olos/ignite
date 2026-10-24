import {
  ARTIFACT_TOOL,
  AUDIO_TOOL,
  BASH_STOP_TOOL,
  BASH_WAIT_TOOL,
  IMAGE_TOOL,
  LEGACY_HTML_TOOL,
  VIDEO_TOOL,
  type TextContent,
  type ToolCall,
  type ToolResult,
} from "../../shared/agentTypes";
import { ADB_TOOL } from "../../shared/adb";
import { CODEMODE_TOOL } from "../../shared/codemode";
import { GH_TOOL, GIT_TOOL } from "../../shared/git";
import { LESSON_ADD_TOOL, LESSON_REMOVE_TOOL } from "../../shared/lessons";
import { ASK_TOOL } from "../../shared/questions";
import { SUBAGENT_TOOL } from "../../shared/subagents";
import { TASK_ADD_TOOL, TASK_TOOL, readProposed } from "../../shared/tasks";
import { argsLine, type McpCall } from "./mcpToolCall";
import { relativeTo } from "./paths";
import { readQuestions } from "./questions";
import type { ToolRun } from "./transcript";

/** The text blocks of a tool's result, joined. */
export function resultText(result: ToolResult | undefined) {
  if (!result) return "";
  return result.content
    .filter((b): b is TextContent => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

/** pi-mcp-adapter's script tool before 6.0.0, still in older conversations. */
export const LEGACY_MCP_SCRIPT = "mcpScript";

const TOOL_TITLES: Record<string, string> = {
  [LEGACY_MCP_SCRIPT]: "MCP script",
  read: "Read",
  write: "Write",
  edit: "Update",
  bash: "Bash",
  grep: "Search",
  find: "Find",
  ls: "List",
  outline: "Outline",
  [GIT_TOOL]: "Git",
  [GH_TOOL]: "GitHub",
  [ASK_TOOL]: "Questions",
  [SUBAGENT_TOOL]: "Agent",
  [IMAGE_TOOL]: "Image",
  [AUDIO_TOOL]: "Audio",
  [VIDEO_TOOL]: "Video",
  [ARTIFACT_TOOL]: "Artifact",
  [LEGACY_HTML_TOOL]: "Artifact",
  [TASK_ADD_TOOL]: "Add tasks",
  [TASK_TOOL]: "Plan",
  [BASH_STOP_TOOL]: "Stop",
  [BASH_WAIT_TOOL]: "Wait",
  [LESSON_ADD_TOOL]: "Lesson",
  [LESSON_REMOVE_TOOL]: "Remove lesson",
  [CODEMODE_TOOL]: "Script",
};

/** A built-in tool's title. */
export function toolTitle(call: ToolCall) {
  if (call.name === "bash" && call.arguments.background) return "Background";
  return TOOL_TITLES[call.name] ?? call.name;
}

/** An MCP tool's name as a title: `get_issue` is "Get issue". */
export function mcpTitle(tool: string) {
  const words = tool
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** An MCP call's arguments on one line, the agent's reason left out. */
export function mcpArg(call: Extract<McpCall, { kind: "call" }>) {
  const { args } = call;
  if (typeof args === "string") return args;
  if (args && typeof args === "object" && !Array.isArray(args)) {
    return argsLine(args as Record<string, unknown>);
  }
  return "";
}

function pathArg(call: ToolCall, folder: string) {
  const path = String(call.arguments.path ?? "");
  return path === folder ? "." : relativeTo(path, folder);
}

function questionsArg(call: ToolCall) {
  return readQuestions(call.arguments)
    .map((q) => q.header ?? q.question)
    .join(", ");
}

function subagentArg(call: ToolCall) {
  const { description, id, model } = call.arguments;
  return String(description || id || model || "");
}

// Paths in the folder are shown relative to it, like `-C server`.
function argsArg(call: ToolCall, folder: string) {
  const args = (call.arguments.args as string[] | undefined) ?? [];
  return args
    .map((arg) => (arg === folder ? "." : relativeTo(arg, folder)))
    .join(" ");
}

const TOOL_ARGS: Record<string, (call: ToolCall, folder: string) => string> = {
  read: pathArg,
  write: pathArg,
  edit: pathArg,
  ls: (call, folder) => pathArg(call, folder) || ".",
  outline: pathArg,
  bash: (call) => String(call.arguments.command ?? ""),
  grep: (call) => String(call.arguments.pattern ?? ""),
  find: (call) => String(call.arguments.pattern ?? ""),
  [GIT_TOOL]: argsArg,
  [GH_TOOL]: argsArg,
  [ADB_TOOL]: argsArg,
  [ASK_TOOL]: questionsArg,
  [SUBAGENT_TOOL]: subagentArg,
  [IMAGE_TOOL]: pathArg,
  [AUDIO_TOOL]: pathArg,
  [VIDEO_TOOL]: pathArg,
  [ARTIFACT_TOOL]: (call) => String(call.arguments.title ?? ""),
  [LEGACY_HTML_TOOL]: (call) => String(call.arguments.title ?? ""),
  [TASK_ADD_TOOL]: (call) => String(readProposed(call.arguments).length),
  [BASH_STOP_TOOL]: (call) => String(call.arguments.pid ?? ""),
  [BASH_WAIT_TOOL]: (call) =>
    [call.arguments.pids ?? [], call.arguments.pid ?? []].flat().join(", "),
  chrome_cdp: (call) => String(call.arguments.method ?? ""),
  chrome_eval: (call) => String(call.arguments.expression ?? ""),
  chrome_navigate: (call) => String(call.arguments.url ?? ""),
  [CODEMODE_TOOL]: () => "",
  [LEGACY_MCP_SCRIPT]: () => "",
};

/** What a tool call shows beside its title; tools with no shape of their own (memory_search, MCP direct tools…) show every argument. */
export function toolArg(call: ToolCall, folder: string) {
  const arg = TOOL_ARGS[call.name]?.(call, folder);
  if (arg !== undefined) return arg;
  return Object.hasOwn(TOOL_TITLES, call.name) ? "" : argsLine(call.arguments);
}

/** The agent's reason for a call (bash and MCP calls carry one), or "". */
export function callReason(call: ToolCall) {
  const { reason } = call.arguments;
  return typeof reason === "string" ? reason.trim() : "";
}

export type ToolBadge = "running" | "error" | "waiting" | "ok";

/** A badge's colour, on a tile's corner or a step's dot. */
export const BADGE_CLASSES: Record<ToolBadge, string> = {
  running: "animate-tool-pulse bg-muted-foreground",
  error: "bg-destructive",
  waiting: "bg-warning",
  ok: "bg-muted-foreground/45",
};

/** A badge as a bare glyph's colour, where there is no tile to put a dot on. */
export const GLYPH_BADGE_CLASSES: Record<ToolBadge, string> = {
  running: "animate-tool-pulse",
  error: "text-destructive",
  waiting: "text-warning",
  ok: "",
};

/** The badge on a call's tile; none once it's done. */
export function toolBadge(run: ToolRun | undefined): ToolBadge | null {
  if (run?.approval) return "waiting";
  if (!run || run.status === "running") return "running";
  return run.status === "error" ? "error" : null;
}

const COMMANDS = new Set(["bash", GIT_TOOL, GH_TOOL]);

/** How many calls share a tile: "4 commands" for shell, git and gh, else "3 calls". */
export function groupCount(calls: ToolCall[]) {
  const noun = COMMANDS.has(calls[0]?.name) ? "command" : "call";
  return `${calls.length} ${noun}${calls.length === 1 ? "" : "s"}`;
}

/** The badge on a tile several calls share: waiting, else running, by any of them; a failure shows on its own step. */
export function groupBadge(runs: (ToolRun | undefined)[]): ToolBadge | null {
  const badges = runs.map(toolBadge);
  return (
    (["waiting", "running"] as const).find((b) => badges.includes(b)) ?? null
  );
}
