import { EditToolBody } from "@/components/conversation/EditToolBody";
import { OutputPreview } from "@/components/conversation/OutputPreview";
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
}: Omit<ToolProps, "folder" | "run"> & { run: ToolRun; text: string }) {
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
    if (running) return null;
    const count = text ? text.split("\n").length : 0;
    return (
      <p>
        Read <span className="font-medium text-foreground">{count}</span>{" "}
        {count === 1 ? "line" : "lines"}
      </p>
    );
  }

  if (!text) return running ? null : <p>(No output)</p>;
  return <OutputPreview text={text} />;
}
