import { SUBAGENT_TOOL, readSubagent } from "../../../shared/subagents";
import { readPlan } from "../../../shared/tasks";
import { OutputPreview } from "@/components/conversation/OutputPreview";
import { PlanCard } from "@/components/conversation/PlanCard";
import type { ToolProps } from "@/components/conversation/shared";
import { SubagentSummary } from "@/components/conversation/SubagentSummary";
import { ToolBody } from "@/components/conversation/ToolBody";
import { WaitingPrompt } from "@/components/conversation/WaitingPrompt";
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
  if (run.approval) {
    return (
      <WaitingPrompt
        call={call}
        approval={run.approval}
        editor={editor}
        codeThemes={codeThemes}
        onApprove={onApprove}
      />
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
