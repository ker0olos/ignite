import { ASK_TOOL } from "../../../shared/questions";
import { ApprovalCommand } from "@/components/conversation/ApprovalCommand";
import { ApprovalPrompt } from "@/components/conversation/ApprovalPrompt";
import { GitChanges } from "@/components/conversation/GitChanges";
import { AskingLine } from "@/components/conversation/AskingLine";
import type { ToolProps } from "@/components/conversation/shared";
import { WaitingTurn } from "@/components/conversation/WaitingTurn";
import { useWaitingPlace } from "@/hooks/useWaitingPlace";
import { approvalCallout } from "@/lib/mcpToolCall";
import { readQuestions } from "@/lib/questions";
import type { ToolRun } from "@/lib/transcript";

/** A call waiting for the user: its approval when it's first (questions show in the composer), else its place in line. */
export function WaitingPrompt({
  call,
  approval,
  editor,
  codeThemes,
  onApprove,
}: Pick<ToolProps, "call" | "editor" | "codeThemes" | "onApprove"> & {
  approval: NonNullable<ToolRun["approval"]>;
}) {
  const { place, count } = useWaitingPlace(call.id);
  if (place > 0) return <WaitingTurn place={place} count={count} />;
  if (call.name === ASK_TOOL) {
    return <AskingLine count={readQuestions(call.arguments).length} />;
  }
  const first = place === 0;
  const queued = first ? count - 1 : 0;
  return (
    <ApprovalPrompt
      {...approvalCallout(call.name, call.arguments, approval.reason)}
      allow={approval.allow}
      shortcuts={first}
      queued={queued}
      onAnswer={(approved, always) =>
        onApprove(call.id, approved, undefined, always)
      }
    >
      <ApprovalCommand call={call} editor={editor} codeThemes={codeThemes} />
      {approval.review && <GitChanges review={approval.review} />}
    </ApprovalPrompt>
  );
}
