import { ASK_TOOL } from "../../../shared/questions";
import { SUBAGENT_TOOL, readSubagent } from "../../../shared/subagents";
import { LESSON_ADD_TOOL, readLessonAdded } from "../../../shared/lessons";
import { readPlan } from "../../../shared/tasks";
import { LessonCard } from "@/components/conversation/LessonCard";
import { ToolError } from "@/components/conversation/ToolError";
import { PlanCard } from "@/components/conversation/PlanCard";
import { QuestionAnswers } from "@/components/conversation/QuestionAnswers";
import type { ToolProps } from "@/components/conversation/shared";
import { SubagentSummary } from "@/components/conversation/SubagentSummary";
import { ToolBody } from "@/components/conversation/ToolBody";
import { WaitingPrompt } from "@/components/conversation/WaitingPrompt";
import { readAnswered } from "@/lib/questions";
import type { ToolRun } from "@/lib/transcript";

/** A subagent call's details; null while it hasn't started, undefined for other calls or one that reported nothing. */
function subagentOf(call: ToolProps["call"], run: ToolRun) {
  if (call.name !== SUBAGENT_TOOL) return undefined;
  const details = readSubagent(run.result?.details);
  return details ?? (run.status === "running" ? null : undefined);
}

function answersOf(call: ToolProps["call"], run: ToolRun) {
  return call.name === ASK_TOOL ? readAnswered(run.result?.details) : undefined;
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
  if (run.status === "error") return <ToolError text={text} />;
  const plan = readPlan(run.result);
  if (plan) return <PlanCard subtasks={plan} />;
  const lesson =
    call.name === LESSON_ADD_TOOL
      ? readLessonAdded(run.result?.details)
      : undefined;
  if (lesson) return <LessonCard {...lesson} />;
  const answered = answersOf(call, run);
  if (answered) return <QuestionAnswers answers={answered} />;
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
