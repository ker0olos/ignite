import { CodeLines } from "@/components/conversation/CodeLines";
import {
  DIFF_PREVIEW_LINES,
  type ToolProps,
} from "@/components/conversation/shared";
import { OutputPreview } from "@/components/conversation/OutputPreview";
import { diffSummary, parseDiff } from "@/lib/toolRows";
import type { ToolRun } from "@/lib/transcript";

/** An `edit` call's diff, or its plain output when no diff is available. */
export function EditToolBody({
  run,
  path,
  text,
  editor,
  codeThemes,
}: Omit<ToolProps, "folder" | "run" | "call" | "onApprove"> & {
  run: ToolRun;
  path: string;
  text: string;
}) {
  const diff = (run.result?.details as { diff?: string } | undefined)?.diff;
  if (!diff)
    return run.status === "running" ? null : <OutputPreview text={text} />;
  const lines = parseDiff(diff);
  return (
    <>
      <p>{diffSummary(lines)}</p>
      <CodeLines
        lines={lines}
        path={path}
        max={DIFF_PREVIEW_LINES}
        editor={editor}
        codeThemes={codeThemes}
      />
    </>
  );
}
