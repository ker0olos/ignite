import { useRef, useState } from "react";
import { ImagePlus, Plus } from "lucide-react";
import type { TaskImage } from "../../../shared/tasks";
import { Kbd } from "@/components/agent/Kbd";
import { TaskAttachment } from "@/components/tasks/TaskAttachment";
import { shortcut } from "@/lib/approvalKeys";
import { taskImages } from "@/lib/tasks";
import { cn } from "@/lib/utils";

const TILE =
  "flex items-center justify-center rounded-md border border-dashed text-muted-foreground transition-colors outline-none hover:border-foreground/30 hover:bg-muted/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50";

/** The sheet's images: a drop zone that browses when clicked, then thumbnails and an add tile. */
export function NewTaskDrop({
  images,
  onChange,
}: {
  images: TaskImage[];
  onChange: (images: TaskImage[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const browse = () => input.current?.click();
  const add = async (files: FileList | null) =>
    onChange([...images, ...(await taskImages(files))]);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void add(e.dataTransfer.files);
      }}
      className={cn(
        "mx-4 mb-3 rounded-[10px] transition-colors",
        over && "bg-muted/60 ring-2 ring-foreground/20",
      )}
    >
      {images.length === 0 ? (
        <button
          type="button"
          onClick={browse}
          className={cn(TILE, "w-full gap-3 rounded-[10px] px-4 py-5")}
        >
          <ImagePlus className="size-5 shrink-0" />
          <span className="flex flex-col items-start gap-0.5 text-left">
            <span className="text-[13px]">
              {over ? "Drop to attach" : "Drop images, or click to browse"}
            </span>
            <span className="text-[11px] opacity-80">
              Screenshots, mockups, sketches
            </span>
          </span>
          <span className="ml-auto">
            <Kbd>{shortcut("V")}</Kbd>
          </span>
        </button>
      ) : (
        <div className="flex flex-wrap gap-2 pt-1.5">
          {images.map((image, i) => (
            <TaskAttachment
              key={i}
              image={image}
              small
              onRemove={() => onChange(images.filter((_, j) => j !== i))}
            />
          ))}
          <button
            type="button"
            aria-label="Add images"
            onClick={browse}
            className={cn(TILE, "h-[54px] w-[76px]")}
          >
            <Plus className="size-4" />
          </button>
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          void add(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
