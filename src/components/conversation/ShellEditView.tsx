import type { ShellEdit } from "../../../shared/shellEdits";
import { CodeLines } from "@/components/conversation/CodeLines";
import {
  DIFF_PREVIEW_LINES,
  type Editor,
} from "@/components/conversation/shared";
import { ToolHead } from "@/components/conversation/ToolHead";
import { ToolOutcome } from "@/components/conversation/ToolOutcome";
import type { CodeThemes } from "@/lib/codeThemes";
import { parseUnifiedDiff } from "@/lib/gitDiff";
import { diffSummary } from "@/lib/toolRows";

/** A file a shell command changed, drawn as an edit: `● Update(path)` and its diff. */
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
    <div className="space-y-1">
      <ToolHead run={{ status: "done" }} title="Update" arg={edit.path} />
      <ToolOutcome>
        {lines.length ? (
          <>
            <p>{diffSummary(lines)}</p>
            <CodeLines
              lines={lines}
              path={edit.path}
              max={DIFF_PREVIEW_LINES}
              editor={editor}
              codeThemes={codeThemes}
            />
          </>
        ) : (
          <p>Changed</p>
        )}
      </ToolOutcome>
    </div>
  );
}
