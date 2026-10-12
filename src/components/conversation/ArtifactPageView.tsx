import { ArtifactHtml } from "@/components/conversation/ArtifactHtml";
import { AssistantText } from "@/components/conversation/AssistantText";
import type { Editor } from "@/components/conversation/shared";
import { frameHeight, type ArtifactPage } from "@/lib/artifact";
import type { CodeThemes } from "@/lib/codeThemes";
import { cn } from "@/lib/utils";

/** One artifact page: HTML in its sandboxed frame, markdown drawn like a reply. */
export function ArtifactPageView({
  page,
  height,
  folder,
  editor,
  codeThemes,
  fill,
}: {
  page: ArtifactPage;
  height?: unknown;
  folder: string;
  editor: Editor;
  codeThemes: CodeThemes;
  /** Fills its parent's height instead of taking `height`. */
  fill?: boolean;
}) {
  if ("html" in page)
    return (
      <ArtifactHtml
        title={page.title}
        html={page.html}
        libraries={page.libraries}
        height={height}
        fill={fill}
      />
    );
  return (
    <div
      className={cn("overflow-y-auto rounded-lg border", fill && "h-full")}
      style={fill ? undefined : { maxHeight: frameHeight(height) }}
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
