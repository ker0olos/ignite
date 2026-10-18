import { Files, FileText, FolderPlus, Image } from "lucide-react";
import type { DropPreview } from "@/lib/dropPreview";

const ICON = { folder: FolderPlus, image: Image, file: FileText, mixed: Files };

/** Over the whole window while something is dragged onto it: what letting go does. */
export function DropOverlay({ preview }: { preview: DropPreview }) {
  const Icon = ICON[preview.kind];
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-[3px]">
      <div className="absolute inset-3 rounded-xl border-[1.5px] border-dashed border-foreground/30" />
      <div className="flex max-w-sm flex-col items-center gap-3 px-6 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl border border-foreground/15 bg-foreground/10">
          <Icon className="size-6" aria-hidden="true" />
        </div>
        <p className="text-[15px] font-semibold">{preview.title}</p>
        <p className="text-[13px] whitespace-pre-line text-muted-foreground">
          {preview.detail}
        </p>
      </div>
    </div>
  );
}
