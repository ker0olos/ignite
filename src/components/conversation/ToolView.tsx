import {
  ARTIFACT_TOOL,
  BASH_STOP_TOOL,
  BASH_WAIT_TOOL,
  IMAGE_TOOL,
  LEGACY_HTML_TOOL,
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
import { ShellEdits } from "@/components/conversation/ShellEdits";
import {
  RunningContext,
  SkipWaitContext,
  type ToolProps,
} from "@/components/conversation/shared";
import { ToolArtifact } from "@/components/conversation/ToolArtifact";
import { ToolHead } from "@/components/conversation/ToolHead";
import { ToolOutcome } from "@/components/conversation/ToolOutcome";
import { ToolRunOutcome } from "@/components/conversation/ToolRunOutcome";
import { useStreamedCall } from "@/hooks/useStreamedCall";
import { rowPages } from "@/lib/artifact";
import { mcpCall } from "@/lib/mcpToolCall";
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
  [ARTIFACT_TOOL]: (call) => String(call.arguments.title ?? ""),
  [LEGACY_HTML_TOOL]: (call) => String(call.arguments.title ?? ""),
  [TASK_ADD_TOOL]: (call) => String(readProposed(call.arguments).length),
  [BASH_STOP_TOOL]: (call) => String(call.arguments.pid ?? ""),
  [BASH_WAIT_TOOL]: (call) => String(call.arguments.pid ?? ""),
};

function toolArg(call: ToolCall, folder: string) {
  return TOOL_ARGS[call.name]?.(call, folder) ?? "";
}

/** One tool call: `● Update(path)` with its outcome underneath, as Claude Code draws it. */
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
  const mcp = mcpCall(call.name, call.arguments);
  const text = resultText(run?.result);
  const skip = useContext(SkipWaitContext);
  const running = useContext(RunningContext);
  const pages = useMemo(
    () => rowPages({ name: call.name, args: shown.arguments }, run, running),
    [call.name, shown.arguments, run, running],
  );
  return (
    <div className="space-y-1">
      <ToolHead
        run={run}
        title={
          mcp ? (
            <McpCallLabel call={mcp} failed={run?.status === "error"} />
          ) : (
            toolTitle(call)
          )
        }
        arg={mcp ? "" : toolArg(shown, folder)}
        folder={folder}
      />
      {pages.length > 0 ? (
        <ToolOutcome>
          <ToolArtifact
            pages={pages}
            height={shown.arguments.height}
            folder={folder}
            editor={editor}
            codeThemes={codeThemes}
          />
        </ToolOutcome>
      ) : (
        run &&
        !showsNothingYet(call, run, text, !!skip && canSkipWait(call, run)) && (
          <ToolOutcome>
            <ToolRunOutcome
              call={call}
              run={run}
              text={text}
              editor={editor}
              codeThemes={codeThemes}
              folder={folder}
              tools={tools}
              onApprove={onApprove}
            />
            <ShellEdits run={run} editor={editor} codeThemes={codeThemes} />
          </ToolOutcome>
        )
      )}
    </div>
  );
}
