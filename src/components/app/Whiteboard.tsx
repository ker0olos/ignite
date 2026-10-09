import type { ImageContent } from "../../../shared/agentTypes";
import { MarkupDialog } from "@/components/app/MarkupDialog";

/** A blank page to draw on (see useWhiteboard). */
export function Whiteboard({
  page,
  onClose,
}: {
  page: ImageContent;
  onClose: () => void;
}) {
  return (
    <MarkupDialog
      image={page}
      name="Whiteboard"
      open
      onOpenChange={(open) => !open && onClose()}
    />
  );
}
