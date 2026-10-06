import { AssistantText } from "@/components/conversation/AssistantText";
import { CompactionRow } from "@/components/conversation/CompactionRow";
import type { Editor, ToolProps } from "@/components/conversation/shared";
import { EndRow } from "@/components/conversation/EndRow";
import { ToolGroup } from "@/components/conversation/ToolGroup";
import { ToolView } from "@/components/conversation/ToolView";
import { UserMessageRow } from "@/components/conversation/UserMessageRow";
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
  stickyUserMessages,
  onApprove,
  last,
}: {
  row: Row;
  /** The conversation's newest row. */
  last: boolean;
  tools: Record<string, ToolRun>;
  folder: string;
  editor: Editor;
  codeThemes: CodeThemes;
  stickyUserMessages: boolean;
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
    case "compaction":
      return <CompactionRow row={row} />;
    case "user":
      return (
        <UserMessageRow message={row.message} sticky={stickyUserMessages} />
      );
    case "text":
      return (
        <AssistantText
          text={row.text}
          folder={folder}
          editor={editor}
          codeThemes={codeThemes}
        />
      );
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
      return <EndRow message={row.message} last={last} />;
  }
}
