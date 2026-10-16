import { useRef, useState } from "react";
import { ArtifactExpandButton } from "@/components/conversation/ArtifactExpandButton";
import { ArtifactMarkupButton } from "@/components/conversation/ArtifactMarkupButton";
import { ArtifactPageView } from "@/components/conversation/ArtifactPageView";
import type { Editor } from "@/components/conversation/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ArtifactPage } from "@/lib/artifact";
import type { CodeThemes } from "@/lib/codeThemes";
import { cn } from "@/lib/utils";

/** show_artifact's pages, as tabs when there are several, and Mark up for the shown one. */
export function ToolArtifact({
  pages,
  height,
  folder,
  editor,
  codeThemes,
}: {
  pages: ArtifactPage[];
  height: unknown;
  folder: string;
  editor: Editor;
  codeThemes: CodeThemes;
}) {
  const [shown, setShown] = useState(0);
  const pageRef = useRef<HTMLDivElement>(null);
  const tabbed = pages.length > 1;
  return (
    <Tabs
      value={shown}
      onValueChange={(value) => setShown(value as number)}
      className={cn("mt-1", tabbed ? "gap-0" : "gap-1")}
    >
      <div
        className={cn(
          "flex items-center gap-2",
          tabbed && "rounded-t-lg border border-b-0 bg-muted px-1.5 py-1",
        )}
      >
        {tabbed && (
          <TabsList className="h-auto max-w-full justify-start gap-1 overflow-x-auto bg-transparent p-0">
            {pages.map((page, i) => (
              <TabsTrigger
                key={i}
                value={i}
                className="flex-none px-3 py-1 text-[13px] data-active:border-border data-active:bg-background data-active:shadow-sm dark:data-active:bg-background"
              >
                {page.title}
              </TabsTrigger>
            ))}
          </TabsList>
        )}
        <div className="ml-auto flex items-center">
          {pages[shown] && (
            <ArtifactExpandButton
              page={pages[shown]}
              folder={folder}
              editor={editor}
              codeThemes={codeThemes}
            />
          )}
          <ArtifactMarkupButton
            page={() => pageRef.current}
            name={pages[shown]?.title ?? ""}
          />
        </div>
      </div>
      {pages.map((page, i) => (
        <TabsContent key={i} value={i} keepMounted>
          <div
            ref={i === shown ? pageRef : undefined}
            className={cn(tabbed && "*:rounded-t-none")}
          >
            <ArtifactPageView
              page={page}
              height={height}
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
