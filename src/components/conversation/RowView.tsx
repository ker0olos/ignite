import { AssistantText } from "@/components/conversation/AssistantText";
import type { Editor, ToolProps } from "@/components/conversation/shared";
import { ThinkingRow } from "@/components/conversation/ThinkingRow";
import { ToolGroup } from "@/components/conversation/ToolGroup";
import { ToolView } from "@/components/conversation/ToolView";
import { UserBubble } from "@/components/conversation/UserBubble";
import type { ToolRun } from "@/lib/transcript";
import type { Row } from "@/lib/toolRows";
import type { CodeThemes } from "@/lib/codeThemes";
import { cn } from "@/lib/utils";

/** One row of the conversation: a message, a tool call, or a status line. */
export function RowView({
  row,
  tools,
  folder,
  editor,
  codeThemes,
  onApprove,
}: {
  row: Row;
  tools: Record<string, ToolRun>;
  folder: string;
  editor: Editor;
  codeThemes: CodeThemes;
  onApprove: ToolProps["onApprove"];
}) {
  switch (row.kind) {
    case "notice":
      return (
        <p
          className={cn(
            "text-xs text-muted-foreground",
            row.error && "text-destructive",
          )}
        >
          {row.text}
        </p>
      );
    case "user":
      return <UserBubble message={row.message} />;
    case "text":
      return (
        <AssistantText
          text={row.text}
          folder={folder}
          editor={editor}
          codeThemes={codeThemes}
        />
      );
    case "thinking":
      return <ThinkingRow thinking={row.thinking} />;
    case "tool":
      return (
        <ToolView
          call={row.call}
          run={tools[row.call.id]}
          folder={folder}
          editor={editor}
          codeThemes={codeThemes}
          tools={tools}
          onApprove={onApprove}
        />
      );
    case "group":
      return (
        <ToolGroup
          calls={row.calls}
          tools={tools}
          folder={folder}
          editor={editor}
          codeThemes={codeThemes}
          onApprove={onApprove}
        />
      );
    case "end":
      return row.message.stopReason === "error" ? (
        <p className="text-[13px] text-destructive">
          {row.message.errorMessage}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Stopped</p>
      );
  }
}
