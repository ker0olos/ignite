import type { SubagentDetails } from "../../../shared/subagents";
import { RowBoundary } from "@/components/conversation/RowBoundary";
import { RowView } from "@/components/conversation/RowView";
import type { Editor, ToolProps } from "@/components/conversation/shared";
import type { CodeThemes } from "@/lib/codeThemes";
import { subagentRows } from "@/lib/subagentRows";
import type { ToolRun } from "@/lib/transcript";

/** A subagent's own conversation, nested under its `subagent` tool call. */
export function SubagentBody({
  details,
  tools,
  folder,
  editor,
  codeThemes,
  onApprove,
}: {
  details: SubagentDetails;
  tools: Record<string, ToolRun> | undefined;
  folder: string;
  editor: Editor;
  codeThemes: CodeThemes;
  onApprove: ToolProps["onApprove"];
}) {
  const { rows, tools: runs } = subagentRows(details, tools);
  return (
    <div className="space-y-2 border-l pl-3">
      {rows.map((row, i) => (
        <RowBoundary key={i} resetOn={row}>
          <RowView
            row={row}
            tools={runs}
            folder={folder}
            editor={editor}
            codeThemes={codeThemes}
            stickyUserMessages={false}
            onApprove={onApprove}
            last={false}
          />
        </RowBoundary>
      ))}
    </div>
  );
}
