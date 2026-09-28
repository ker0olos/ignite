import { ASK_TOOL } from "../../../shared/questions";
import { ApprovalPrompt } from "@/components/conversation/ApprovalPrompt";
import { OutputPreview } from "@/components/conversation/OutputPreview";
import type { ToolProps } from "@/components/conversation/shared";
import { QuestionPrompt } from "@/components/conversation/QuestionPrompt";
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
  onApprove,
}: Omit<ToolProps, "folder" | "run"> & { run: ToolRun; text: string }) {
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
        onAnswer={(approved) => onApprove(call.id, approved)}
      />
    );
  }
  if (run.status === "error") {
    return <OutputPreview text={text || "Failed."} error />;
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
