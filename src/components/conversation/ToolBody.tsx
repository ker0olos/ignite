import { EditToolBody } from "@/components/conversation/EditToolBody";
import { OutputPreview } from "@/components/conversation/OutputPreview";
import { ReadToolBody } from "@/components/conversation/ReadToolBody";
import type { ToolProps } from "@/components/conversation/shared";
import { WriteToolBody } from "@/components/conversation/WriteToolBody";
import type { ToolRun } from "@/lib/transcript";

/** A tool call's outcome, formatted per tool: a diff, new lines, or plain output. */
export function ToolBody({
  call,
  run,
  text,
  editor,
  codeThemes,
}: Omit<ToolProps, "folder" | "run" | "onApprove"> & {
  run: ToolRun;
  text: string;
}) {
  const path = String(call.arguments.path ?? "");
  const running = run.status === "running";

  if (call.name === "edit") {
    return (
      <EditToolBody
        run={run}
        path={path}
        text={text}
        editor={editor}
        codeThemes={codeThemes}
      />
    );
  }

  if (call.name === "write") {
    return (
      <WriteToolBody
        content={String(call.arguments.content ?? "")}
        path={path}
        running={running}
        editor={editor}
        codeThemes={codeThemes}
      />
    );
  }

  if (call.name === "read") {
    return <ReadToolBody running={running} text={text} />;
  }

  if (!text) return running ? null : <p>(No output)</p>;
  return <OutputPreview text={text} />;
}
