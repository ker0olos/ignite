import { X } from "lucide-react";
import type { TaskImage } from "../../../shared/tasks";
import { imageUrl } from "@/lib/images";
import { cn } from "@/lib/utils";

/** One image given to a task, as a thumbnail; removable when `onRemove` is set. */
export function TaskAttachment({
  image,
  small,
  onRemove,
}: {
  image: TaskImage;
  small?: boolean;
  onRemove?: () => void;
}) {
  return (
    <div className="group/image relative shrink-0">
      <img
        src={imageUrl(image)}
        alt={image.name}
        title={image.name}
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
