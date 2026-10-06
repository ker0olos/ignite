import type { ModelRouter } from "@/components/agent/Composer";
import { NewTaskForm } from "@/components/tasks/NewTaskForm";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { HostClient } from "@/lib/piHost";
import type { TaskImage } from "../../../shared/tasks";
import type { TaskDraft } from "@/lib/tasks";

/** The new-task sheet: title, notes, images and subtasks in a dialog. */
export function NewTaskDialog({
  host,
  open,
  images,
  modelRouter,
  onOpenChange,
  onCreate,
}: {
  host: HostClient | null;
  open: boolean;
  /** Images the sheet opens with. */
  images?: TaskImage[];
  modelRouter?: ModelRouter;
  onOpenChange: (open: boolean) => void;
  onCreate: (draft: TaskDraft, now: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 overflow-hidden bg-background p-0 sm:max-w-[560px]"
      >
        <DialogTitle className="sr-only">New task</DialogTitle>
        <NewTaskForm
          host={host}
          images={images}
          modelRouter={modelRouter}
          onCreate={onCreate}
        />
      </DialogContent>
    </Dialog>
  );
}
