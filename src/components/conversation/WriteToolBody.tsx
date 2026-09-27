import { CodeLines } from "@/components/conversation/CodeLines";
import {
  CODE_PREVIEW_LINES,
  type ToolProps,
} from "@/components/conversation/shared";
import type { DiffLine } from "@/lib/toolRows";

/** A `write` call's new content, shown as added lines. */
export function WriteToolBody({
  content,
  path,
  running,
  editor,
  codeThemes,
}: Omit<ToolProps, "folder" | "run" | "call"> & {
  content: string;
  path: string;
  running: boolean;
}) {
  const lines: DiffLine[] = content
    .replace(/\n$/, "")
    .split("\n")
    .map((text, i) => ({ kind: "ctx", num: i + 1, text }));
  return (
    <>
      <p>
        {running ? "Writing" : "Wrote"}{" "}
        <span className="font-medium text-foreground">{lines.length}</span>{" "}
        {lines.length === 1 ? "line" : "lines"}
      </p>
      <CodeLines
        lines={lines}
        path={path}
        max={CODE_PREVIEW_LINES}
        editor={editor}
        codeThemes={codeThemes}
      />
    </>
  );
}
