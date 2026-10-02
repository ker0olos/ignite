import { Plus } from "lucide-react";
import type { ImageContent } from "../../../shared/agentTypes";
import { MENU_TRIGGER } from "@/components/agent/styles";
import { pickImages } from "@/lib/images";
import { cn } from "@/lib/utils";

/** The composer's + button: picks images to attach. */
export function AttachImagesButton({
  onAttach,
}: {
  onAttach: (images: ImageContent[]) => void;
}) {
  return (
    <button
      type="button"
      aria-label="Attach images"
      // A finger-sized target on a phone, still flush with the text's edge.
      className={cn(
        MENU_TRIGGER,
        "max-sm:-ml-2.5 max-sm:size-10 max-sm:justify-center",
      )}
      onClick={() => void pickImages().then(onAttach)}
    >
      <Plus className="size-3.5 max-sm:size-5" />
    </button>
  );
}
