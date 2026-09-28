import type {
  TextContent,
  ToolCall,
  ToolResult,
} from "../../../shared/agentTypes";
import { ASK_TOOL } from "../../../shared/questions";
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
  [ASK_TOOL]: "Questions",
};

function toolArg(call: ToolCall, folder: string) {
  const arg = (key: string) => String(call.arguments[key] ?? "");
  switch (call.name) {
    case "read":
    case "write":
    case "edit":
      return relativePath(arg("path"), folder);
    case "ls":
      return relativePath(arg("path"), folder) || ".";
    case "bash":
      return arg("command");
    case "grep":
    case "find":
      return arg("pattern");
    case ASK_TOOL:
      return readQuestions(call.arguments)
        .map((q) => q.header ?? q.question)
        .join(", ");
    default:
      return "";
  }
}

/** One tool call: `● Update(path)` with its outcome underneath, as Claude Code draws it. */
export function ToolView({
  call,
  run,
  folder,
  editor,
  codeThemes,
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
            <McpCallLabel call={mcp} />
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
            onApprove={onApprove}
          />
        </ToolOutcome>
      )}
    </div>
  );
}
