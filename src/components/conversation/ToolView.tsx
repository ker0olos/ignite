import type {
  TextContent,
  ToolCall,
  ToolResult,
} from "../../../shared/agentTypes";
import { GH_TOOL, GIT_TOOL } from "../../../shared/git";
import { ASK_TOOL } from "../../../shared/questions";
import { SUBAGENT_TOOL } from "../../../shared/subagents";
import { McpCallLabel } from "@/components/conversation/McpCallLabel";
import type { ToolProps } from "@/components/conversation/shared";
import { ToolHead } from "@/components/conversation/ToolHead";
import { ToolOutcome } from "@/components/conversation/ToolOutcome";
import { ToolRunOutcome } from "@/components/conversation/ToolRunOutcome";
import { mcpCall } from "@/lib/mcpToolCall";
import { readQuestions } from "@/lib/questions";

/** Path relative to the open folder when it's inside it, else as given. */
function relativePath(path: string, folder: string) {
  return path.startsWith(folder + "/") ? path.slice(folder.length + 1) : path;
}

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
};

function pathArg(call: ToolCall, folder: string) {
  return relativePath(String(call.arguments.path ?? ""), folder);
}

function questionsArg(call: ToolCall) {
  return readQuestions(call.arguments)
    .map((q) => q.header ?? q.question)
    .join(", ");
}

function subagentArg(call: ToolCall) {
  const arg = (key: string) => String(call.arguments[key] ?? "");
  return call.arguments.id
    ? String(call.arguments.id)
    : `${arg("model")}, ${arg("effort")}`;
}

// Paths in the folder are shown relative to it, like `-C server`.
function gitArg(call: ToolCall, folder: string) {
  const args = (call.arguments.args as string[] | undefined) ?? [];
  return args
    .map((arg) => (arg === folder ? "." : relativePath(arg, folder)))
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
  [GIT_TOOL]: gitArg,
  [GH_TOOL]: gitArg,
  [ASK_TOOL]: questionsArg,
  [SUBAGENT_TOOL]: subagentArg,
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
  const mcp = mcpCall(call.name, call.arguments);
  const text = resultText(run?.result);
  return (
    <div className="space-y-1">
      <ToolHead
        run={run}
        title={
          mcp ? (
            <McpCallLabel call={mcp} failed={run?.status === "error"} />
          ) : (
            (TOOL_TITLES[call.name] ?? call.name)
          )
        }
        arg={mcp ? "" : toolArg(call, folder)}
      />
      {run && (
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
        </ToolOutcome>
      )}
    </div>
  );
}
