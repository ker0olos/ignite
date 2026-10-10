import { ArtifactHtml } from "@/components/conversation/ArtifactHtml";
import { AssistantText } from "@/components/conversation/AssistantText";
import type { Editor } from "@/components/conversation/shared";
import { frameHeight, type ArtifactPage } from "@/lib/artifact";
import type { CodeThemes } from "@/lib/codeThemes";

/** One artifact page: HTML in its sandboxed frame, markdown drawn like a reply. */
export function ArtifactPageView({
  page,
  height,
  folder,
  editor,
  codeThemes,
}: {
  page: ArtifactPage;
  height: unknown;
  folder: string;
  editor: Editor;
  codeThemes: CodeThemes;
}) {
  if ("html" in page)
    return (
      <ArtifactHtml
        title={page.title}
        html={page.html}
        libraries={page.libraries}
        height={height}
      />
    );
  return (
    <div
      className="overflow-y-auto rounded-lg border"
      style={{ maxHeight: frameHeight(height) }}
    >
      <div data-artifact-content className="px-4 py-3">
        <AssistantText
          text={page.markdown}
          folder={folder}
          editor={editor}
          codeThemes={codeThemes}
        />
      </div>
    </div>
  );
}
