import type { ShellEdit } from "../../../shared/shellEdits";
import { CodeLines } from "@/components/conversation/CodeLines";
import {
  DIFF_PREVIEW_LINES,
  type Editor,
} from "@/components/conversation/shared";
import type { CodeThemes } from "@/lib/codeThemes";
import { parseUnifiedDiff } from "@/lib/gitDiff";
import { diffSummary } from "@/lib/toolRows";

/** A file a shell command changed, under its bash call: the path, a summary and its diff. */
export function ShellEditView({
  edit,
  editor,
  codeThemes,
}: {
  edit: ShellEdit;
  editor: Editor;
  codeThemes: CodeThemes;
}) {
  const lines = parseUnifiedDiff(edit.diff);
  return (
    <>
      <p>
        <span className="text-foreground">{edit.path}</span>
        {" · "}
        {lines.length ? diffSummary(lines) : "Changed"}
      </p>
      {lines.length > 0 && (
        <CodeLines
          lines={lines}
          path={edit.path}
          max={DIFF_PREVIEW_LINES}
          editor={editor}
          codeThemes={codeThemes}
        />
      )}
    </>
  );
}
