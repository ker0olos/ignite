import type { ShellEdit } from "../../../shared/shellEdits";
import { CodeLines } from "@/components/conversation/CodeLines";
import { ImageCompare } from "@/components/conversation/ImageCompare";
import {
  DIFF_PREVIEW_LINES,
  type Editor,
} from "@/components/conversation/shared";
import type { CodeThemes } from "@/lib/codeThemes";
import { parseUnifiedDiff } from "@/lib/gitDiff";
import { diffSummary } from "@/lib/toolRows";

/** A file a shell command changed, under its bash call: the path, a summary, an image's versions to compare and its diff. */
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
  // A new or deleted image is compared with itself, so every image looks alike.
  const before = edit.before ?? edit.after;
  const after = edit.after ?? edit.before;
  return (
    <>
      <p>
        <span className="text-foreground">{edit.path}</span>
        {" · "}
        {lines.length ? diffSummary(lines) : "Changed"}
      </p>
      {before && after && (
        <ImageCompare before={before} after={after} name={edit.path} />
      )}
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
