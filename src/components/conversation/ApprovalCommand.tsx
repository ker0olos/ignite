import type { ToolCall } from "../../../shared/agentTypes";
import { CodeBlock } from "@/components/conversation/CodeBlock";
import type { Editor } from "@/components/conversation/shared";
import type { CodeThemes } from "@/lib/codeThemes";

/** A waiting bash call's whole command, highlighted like a terminal line. */
export function ApprovalCommand({
  call,
  editor,
  codeThemes,
}: {
  call: ToolCall;
  editor: Editor;
  codeThemes: CodeThemes;
}) {
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
