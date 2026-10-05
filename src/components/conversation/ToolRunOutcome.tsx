import { ASK_TOOL } from "../../../shared/questions";
import { SUBAGENT_TOOL, readSubagent } from "../../../shared/subagents";
import { readPlan } from "../../../shared/tasks";
import { ApprovalPrompt } from "@/components/conversation/ApprovalPrompt";
import { ApprovalCommand } from "@/components/conversation/ApprovalCommand";
import { useIsFirstApproval } from "@/hooks/useFirstApproval";
import { GitChanges } from "@/components/conversation/GitChanges";
import { OutputPreview } from "@/components/conversation/OutputPreview";
import { PlanCard } from "@/components/conversation/PlanCard";
import type { ToolProps } from "@/components/conversation/shared";
import { QuestionPrompt } from "@/components/conversation/QuestionPrompt";
import { SubagentSummary } from "@/components/conversation/SubagentSummary";
import { ToolBody } from "@/components/conversation/ToolBody";
import { readQuestions } from "@/lib/questions";
import type { ToolRun } from "@/lib/transcript";

/** A subagent call's details; null while it hasn't started, undefined for other calls or one that reported nothing. */
function subagentOf(call: ToolProps["call"], run: ToolRun) {
  if (call.name !== SUBAGENT_TOOL) return undefined;
  const details = readSubagent(run.result?.details);
  return details ?? (run.status === "running" ? null : undefined);
}

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
        shortcuts={first}
        onAnswer={(approved, answers) => onApprove(call.id, approved, answers)}
      />
    );
  }
  if (run.approval) {
    return (
      <ApprovalPrompt
        why={
          typeof call.arguments.reason === "string"
            ? call.arguments.reason
            : undefined
        }
        reason={run.approval.reason}
        allow={run.approval.allow}
        shortcuts={first}
        onAnswer={(approved, always) =>
          onApprove(call.id, approved, undefined, always)
        }
      >
        <ApprovalCommand call={call} editor={editor} codeThemes={codeThemes} />
        {run.approval.review && <GitChanges review={run.approval.review} />}
      </ApprovalPrompt>
    );
  }
  if (run.status === "error") {
    return <OutputPreview text={text || "Failed."} error />;
  }
  const plan = readPlan(run.result);
  if (plan) return <PlanCard subtasks={plan} />;
  const subagent = subagentOf(call, run);
  if (subagent !== undefined) {
    return (
      <SubagentSummary
        details={subagent}
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
