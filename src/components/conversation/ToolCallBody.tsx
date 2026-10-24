import { useContext, useMemo } from "react";
import type { ToolCall } from "../../../shared/agentTypes";
import { pickMediaCard } from "@/components/conversation/pickMediaCard";
import {
  RunningContext,
  SkipWaitContext,
  type ToolProps,
} from "@/components/conversation/shared";
import { ToolOutcomeBody } from "@/components/conversation/ToolOutcomeBody";
import { rowPages } from "@/lib/artifact";
import { resultText } from "@/lib/toolLabels";
import { canSkipWait, showsNothingYet } from "@/lib/toolRows";
import type { ToolRun } from "@/lib/transcript";
import { cn } from "@/lib/utils";

function hasOutcome(
  call: ToolCall,
  run: ToolRun | undefined,
  text: string,
  skip: unknown,
  pages: number,
) {
  if (pages > 0) return true;
  if (!run) return false;
  return !showsNothingYet(call, run, text, !!skip && canSkipWait(call, run));
}

/** What a tool call shows under its title: its outcome, a generated media's card, or "Didn’t run". Nothing while there's nothing to show. */
export function ToolCallBody({
  call,
  shown,
  run,
  folder,
  editor,
  codeThemes,
  tools,
  onApprove,
}: ToolProps & { shown: ToolCall }) {
  const text = resultText(run?.result);
  const skip = useContext(SkipWaitContext);
  const running = useContext(RunningContext);
  const pages = useMemo(
    () => rowPages({ name: call.name, args: shown.arguments }, run, running),
    [call.name, shown.arguments, run, running],
  );
  const outcome = hasOutcome(call, run, text, skip, pages.length) && (
    <ToolOutcomeBody
      call={call}
      pages={pages}
      height={shown.arguments.height}
      run={run}
      text={text}
      folder={folder}
      editor={editor}
      codeThemes={codeThemes}
      tools={tools}
      onApprove={onApprove}
    />
  );
  const body = run?.cancelled
    ? "Didn’t run"
    : (pickMediaCard({ call: shown, run, folder }) ?? outcome);
  if (!body) return null;
  return (
    <div
      className={cn(
        "mt-1.5 min-w-0 space-y-1.5 text-[13.5px] text-muted-foreground",
        run?.approval && "mt-2",
      )}
    >
      {body}
    </div>
  );
}
