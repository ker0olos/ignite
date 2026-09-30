import { X } from "lucide-react";
import type { TaskImage } from "../../../shared/tasks";
import { ZoomableImage } from "@/components/app/ZoomableImage";
import { cn } from "@/lib/utils";

/** One image given to a task, as a thumbnail; removable and markable when `onRemove` and `onEdit` are set. */
export function TaskAttachment({
  image,
  small,
  onRemove,
  onEdit,
}: {
  image: TaskImage;
  small?: boolean;
  onRemove?: () => void;
  onEdit?: (image: TaskImage) => void;
}) {
  return (
    <div className="group/image relative shrink-0">
      <ZoomableImage
        image={image}
        name={image.name}
        onEdit={onEdit && ((marked) => onEdit({ ...marked, name: image.name }))}
        className={cn(
          "rounded-md border object-cover object-top-left",
          small ? "h-[54px] w-[76px]" : "h-[68px] w-24",
        )}
      />
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${image.name}`}
          onClick={onRemove}
          className="absolute -top-1.5 -right-1.5 hidden size-4 items-center justify-center rounded-full bg-foreground text-background group-hover/image:flex focus-visible:flex pointer-coarse:flex"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}
