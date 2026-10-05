import { readShellEdits } from "../../../shared/shellEdits";
import { ShellEditView } from "@/components/conversation/ShellEditView";
import type { Editor } from "@/components/conversation/shared";
import type { CodeThemes } from "@/lib/codeThemes";
import type { ToolRun } from "@/lib/transcript";

/** The files a bash call changed, each drawn under it as an edit. */
export function ShellEdits({
  run,
  editor,
  codeThemes,
}: {
  run: ToolRun | undefined;
  editor: Editor;
  codeThemes: CodeThemes;
}) {
  return readShellEdits(run?.result?.details).map((edit) => (
    <ShellEditView
      key={edit.path}
      edit={edit}
      editor={editor}
      codeThemes={codeThemes}
    />
  ));
}
