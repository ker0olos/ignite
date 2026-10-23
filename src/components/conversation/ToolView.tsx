import {
  ARTIFACT_TOOL,
  BASH_STOP_TOOL,
  AUDIO_TOOL,
  BASH_WAIT_TOOL,
  IMAGE_TOOL,
  LEGACY_HTML_TOOL,
  VIDEO_TOOL,
  type TextContent,
  type ToolCall,
  type ToolResult,
} from "../../../shared/agentTypes";
import { ADB_TOOL } from "../../../shared/adb";
import { GH_TOOL, GIT_TOOL } from "../../../shared/git";
import { LESSON_ADD_TOOL, LESSON_REMOVE_TOOL } from "../../../shared/lessons";
import { ASK_TOOL } from "../../../shared/questions";
import { SUBAGENT_TOOL } from "../../../shared/subagents";
import { TASK_ADD_TOOL, TASK_TOOL, readProposed } from "../../../shared/tasks";
import { useContext, useMemo } from "react";
import { McpCallLabel } from "@/components/conversation/McpCallLabel";
import { pickMediaCard } from "@/components/conversation/pickMediaCard";
import {
  RunningContext,
  SkipWaitContext,
  type ToolProps,
} from "@/components/conversation/shared";
import { ToolHead } from "@/components/conversation/ToolHead";
import { ToolOutcome } from "@/components/conversation/ToolOutcome";
import { ToolOutcomeBody } from "@/components/conversation/ToolOutcomeBody";
import { useStreamedCall } from "@/hooks/useStreamedCall";
import { rowPages } from "@/lib/artifact";
import type { ToolRun } from "@/lib/transcript";
import { argsLine, mcpCall } from "@/lib/mcpToolCall";
import { readQuestions } from "@/lib/questions";
import { canSkipWait, showsNothingYet } from "@/lib/toolRows";
import { relativeTo } from "@/lib/paths";

function resultText(result: ToolResult | undefined) {
  if (!result) return "";
  return result.content
    .filter((b): b is TextContent => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

const TOOL_TITLES: Record<string, string> = {
  read: "Read",
  write: "Write",
  edit: "Update",
  bash: "Bash",
  grep: "Search",
  find: "Find",
  ls: "List",
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
};

function toolTitle(call: ToolCall) {
  if (call.name === "bash" && call.arguments.background) return "Background";
  return TOOL_TITLES[call.name] ?? call.name;
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
};

// Tools with no shape of their own (memory_search, MCP direct tools…) show every argument.
function toolArg(call: ToolCall, folder: string) {
  const arg = TOOL_ARGS[call.name]?.(call, folder);
  if (arg !== undefined) return arg;
  return Object.hasOwn(TOOL_TITLES, call.name) ? "" : argsLine(call.arguments);
}

function hasOutcome(
  call: ToolCall,
  run: ToolRun | undefined,
  text: string,
  skip: unknown,
  pages: number,
) {
  if (pages > 0) return true;
  if (!run) return false;
  return !showsNothingYet(call, run, text, !!skip && canSkipWait(call, run));
}

function headOf(
  call: ToolCall,
  shown: ToolCall,
  run: ToolRun | undefined,
  folder: string,
) {
  const mcp = mcpCall(call.name, call.arguments);
  const title = mcp ? (
    <McpCallLabel call={mcp} failed={run?.status === "error"} />
  ) : (
    toolTitle(call)
  );
  return (
    <ToolHead
      run={run}
      title={title}
      arg={mcp ? "" : toolArg(shown, folder)}
      folder={folder}
    />
  );
}

/** One tool call: `● Update(path)` with its outcome underneath, as Claude Code draws it; a generated media's card there. */
export function ToolView({
  call,
  run,
  folder,
  editor,
  codeThemes,
  tools,
  onApprove,
}: ToolProps) {
  const shown = useStreamedCall(call);
  const text = resultText(run?.result);
  const skip = useContext(SkipWaitContext);
  const running = useContext(RunningContext);
  const pages = useMemo(
    () => rowPages({ name: call.name, args: shown.arguments }, run, running),
    [call.name, shown.arguments, run, running],
  );
  const outcome = hasOutcome(call, run, text, skip, pages.length) && (
    <ToolOutcomeBody
      call={call}
      pages={pages}
      height={shown.arguments.height}
      run={run}
      text={text}
      folder={folder}
      editor={editor}
      codeThemes={codeThemes}
      tools={tools}
      onApprove={onApprove}
    />
  );
  const body = pickMediaCard({ call: shown, run, folder }) ?? outcome;
  return (
    <div className="space-y-1">
      {headOf(call, shown, run, folder)}
      {body && <ToolOutcome>{body}</ToolOutcome>}
    </div>
  );
}
