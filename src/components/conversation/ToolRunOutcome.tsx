import { ASK_TOOL } from "../../../shared/questions";
import { SUBAGENT_TOOL, readSubagent } from "../../../shared/subagents";
import { ApprovalPrompt } from "@/components/conversation/ApprovalPrompt";
import { ApprovalCommand } from "@/components/conversation/ApprovalCommand";
import { useIsFirstApproval } from "@/hooks/useFirstApproval";
import { GitChanges } from "@/components/conversation/GitChanges";
import { OutputPreview } from "@/components/conversation/OutputPreview";
import type { ToolProps } from "@/components/conversation/shared";
import { QuestionPrompt } from "@/components/conversation/QuestionPrompt";
import { SubagentBody } from "@/components/conversation/SubagentBody";
import { ToolBody } from "@/components/conversation/ToolBody";
import { readQuestions } from "@/lib/questions";
import type { ToolRun } from "@/lib/transcript";

/** What a started call shows: an approval prompt or questions, its error, or its output. */
export function ToolRunOutcome({
  call,
  run,
  text,
  editor,
  codeThemes,
  folder,
  tools,
  onApprove,
}: Omit<ToolProps, "run"> & { run: ToolRun; text: string }) {
  const first = useIsFirstApproval(call.id);
  if (run.approval && call.name === ASK_TOOL) {
    return (
      <QuestionPrompt
        questions={readQuestions(call.arguments)}
        onAnswer={(approved, answers) => onApprove(call.id, approved, answers)}
      />
    );
  }
  if (run.approval) {
    return (
      <ApprovalPrompt
        reason={run.approval.reason}
        shortcuts={first}
        onAnswer={(approved) => onApprove(call.id, approved)}
      >
        <ApprovalCommand call={call} editor={editor} codeThemes={codeThemes} />
        {run.approval.review && <GitChanges review={run.approval.review} />}
      </ApprovalPrompt>
    );
  }
  if (run.status === "error") {
    return <OutputPreview text={text || "Failed."} error />;
  }
  const details =
    call.name === SUBAGENT_TOOL ? readSubagent(run.result?.details) : undefined;
  if (details) {
    return (
      <SubagentBody
        details={details}
        tools={tools}
        folder={folder}
        editor={editor}
        codeThemes={codeThemes}
        onApprove={onApprove}
      />
    );
  }
  return (
    <ToolBody
      call={call}
      run={run}
      text={text}
      editor={editor}
      codeThemes={codeThemes}
    />
  );
}
