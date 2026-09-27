import { ApprovalPrompt } from "@/components/conversation/ApprovalPrompt";
import { OutputPreview } from "@/components/conversation/OutputPreview";
import type { ToolProps } from "@/components/conversation/shared";
import { ToolBody } from "@/components/conversation/ToolBody";
import type { ToolRun } from "@/lib/transcript";

/** What a started call shows: an approval prompt, its error, or its output. */
export function ToolRunOutcome({
  call,
  run,
  text,
  editor,
  codeThemes,
  onApprove,
}: Omit<ToolProps, "folder" | "run"> & { run: ToolRun; text: string }) {
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
