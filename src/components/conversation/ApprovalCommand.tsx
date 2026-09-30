import type { ToolCall } from "../../../shared/agentTypes";
import { TASK_ADD_TOOL, readProposed } from "../../../shared/tasks";
import { CodeBlock } from "@/components/conversation/CodeBlock";
import { ProposedTasks } from "@/components/conversation/ProposedTasks";
import type { Editor } from "@/components/conversation/shared";
import type { CodeThemes } from "@/lib/codeThemes";

/** What a waiting call would do: a bash call's whole command, or the tasks it would add. */
export function ApprovalCommand({
  call,
  editor,
  codeThemes,
}: {
  call: ToolCall;
  editor: Editor;
  codeThemes: CodeThemes;
}) {
  if (call.name === TASK_ADD_TOOL) {
    return <ProposedTasks tasks={readProposed(call.arguments)} />;
  }
  if (call.name !== "bash") return null;
  return (
    <CodeBlock
      code={String(call.arguments.command ?? "")}
      lang="sh"
      editor={editor}
      codeThemes={codeThemes}
      className="terminal wrap [&_pre]:w-auto"
    />
  );
}
