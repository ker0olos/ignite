import { useCallback, useState, type SyntheticEvent } from "react";
import { Maximize2 } from "lucide-react";
import { ArtifactPageView } from "@/components/conversation/ArtifactPageView";
import type { Editor } from "@/components/conversation/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useFrameEscape } from "@/hooks/useFrameEscape";
import type { ArtifactPage } from "@/lib/artifact";
import type { CodeThemes } from "@/lib/codeThemes";

/** Opens the shown artifact page over nearly the whole window. */
export function ArtifactExpandButton({
  page,
  folder,
  editor,
  codeThemes,
}: {
  page: ArtifactPage;
  folder: string;
  editor: Editor;
  codeThemes: CodeThemes;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  useFrameEscape(open, close);
  // A file link opens its tab behind the dialog, so the dialog makes way.
  const onFileLink = (e: SyntheticEvent) => {
    const link = (e.target as Element).closest?.('[data-link="file"]');
    if (link && (!("key" in e) || e.key === "Enter" || e.key === " ")) close();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            size="xs"
            variant="ghost"
            className="text-[13px] text-muted-foreground"
          />
        }
      >
        <Maximize2 />
        Expand
      </DialogTrigger>
      {/* Starts below the traffic lights. */}
      <DialogContent
        onClickCapture={onFileLink}
        onKeyDownCapture={onFileLink}
        className="top-14 flex h-[calc(100dvh-4.5rem)] max-w-[calc(100vw-2rem)] translate-y-0 flex-col gap-3 sm:max-w-[calc(100vw-2rem)]"
      >
        <DialogTitle className="pr-8 text-[13px]">{page.title}</DialogTitle>
        <div className="min-h-0 flex-1">
          <ArtifactPageView
            page={page}
            folder={folder}
            editor={editor}
            codeThemes={codeThemes}
            fill
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
