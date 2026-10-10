import { useRef, useState } from "react";
import { ArtifactMarkupButton } from "@/components/conversation/ArtifactMarkupButton";
import { ArtifactPageView } from "@/components/conversation/ArtifactPageView";
import type { Editor } from "@/components/conversation/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { artifactPages } from "@/lib/artifact";
import type { CodeThemes } from "@/lib/codeThemes";

/** show_artifact's pages, as tabs when there are several, and Mark up for the shown one. */
export function ToolArtifact({
  args,
  folder,
  editor,
  codeThemes,
}: {
  args: Record<string, unknown>;
  folder: string;
  editor: Editor;
  codeThemes: CodeThemes;
}) {
  const pages = artifactPages(args);
  const [shown, setShown] = useState(0);
  const pageRef = useRef<HTMLDivElement>(null);
  if (!pages.length) return null;
  return (
    <Tabs
      value={shown}
      onValueChange={(value) => setShown(value as number)}
      className="mt-1 gap-1"
    >
      <div className="flex items-center gap-2">
        {pages.length > 1 && (
          <TabsList className="max-w-full justify-start overflow-x-auto">
            {pages.map((page, i) => (
              <TabsTrigger key={i} value={i} className="flex-none text-[13px]">
                {page.title}
              </TabsTrigger>
            ))}
          </TabsList>
        )}
        <ArtifactMarkupButton
          page={() => pageRef.current}
          name={pages[shown]?.title ?? ""}
        />
      </div>
      {pages.map((page, i) => (
        <TabsContent key={i} value={i} keepMounted>
          <div ref={i === shown ? pageRef : undefined}>
            <ArtifactPageView
              page={page}
              height={args.height}
              folder={folder}
              editor={editor}
              codeThemes={codeThemes}
            />
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
