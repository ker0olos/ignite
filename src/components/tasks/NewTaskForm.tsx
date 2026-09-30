import { useState } from "react";
import { Play } from "lucide-react";
import { NewTaskDrop } from "@/components/tasks/NewTaskDrop";
import { NewTaskSubtasks } from "@/components/tasks/NewTaskSubtasks";
import { NewTaskChoices } from "@/components/tasks/NewTaskChoices";
import { Button } from "@/components/ui/button";
import type { Pending } from "@/hooks/useComposerActions";
import { useProvideImageTarget } from "@/hooks/useImageTarget";
import { useDraftState } from "@/hooks/useDraftState";
import type { HostClient } from "@/lib/piHost";
import { shortcut } from "@/lib/approvalKeys";
import type { TaskImage } from "../../../shared/tasks";
import { choicesOf, taskImages, type TaskDraft } from "@/lib/tasks";

/** The new-task sheet's fields and footer: model, effort, Save for later and Start now. */
export function NewTaskForm({
  host,
  images = [],
  onCreate,
}: {
  host: HostClient | null;
  images?: TaskImage[];
  onCreate: (draft: TaskDraft, now: boolean) => void;
}) {
  const [draft, setDraft] = useState<TaskDraft>({
    title: "",
    notes: "",
    images,
    subtasks: [],
  });
  const addImages = (added: TaskImage[]) =>
    setDraft((d) => ({ ...d, images: [...d.images, ...added] }));
  useProvideImageTarget("Add to task", (image, name) =>
    addImages([{ ...image, name }]),
  );
  const [pending, setPending] = useState<Pending>({});
  const state = useDraftState(host, true, pending, null);
  const patch = (p: Partial<TaskDraft>) => setDraft({ ...draft, ...p });
  const ready = draft.title.trim() !== "";
  const submit = (now: boolean) =>
    ready && onCreate({ ...draft, ...choicesOf(state) }, now);

  return (
    <div
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(true);
      }}
      // Pasted images attach from any field; pasted text still goes in.
      onPaste={(e) => {
        if (e.clipboardData.files.length === 0) return;
        e.preventDefault();
        void taskImages(e.clipboardData.files).then(addImages);
      }}
    >
      <input
        autoFocus
        value={draft.title}
        onChange={(e) => patch({ title: e.target.value })}
        placeholder="Task title"
        spellCheck={false}
        className="w-full bg-transparent px-4 pt-[18px] pb-1 text-base font-semibold outline-none placeholder:text-muted-foreground"
      />
      <textarea
        value={draft.notes}
        onChange={(e) => patch({ notes: e.target.value })}
        placeholder="Notes for the agent: goals, constraints, links"
        spellCheck={false}
        className="min-h-16 w-full resize-none bg-transparent px-4 pt-1 pb-3 text-[13px] text-muted-foreground outline-none placeholder:text-muted-foreground"
      />
      <NewTaskDrop
        images={draft.images}
        onChange={(images) => patch({ images })}
      />
      <NewTaskSubtasks
        subtasks={draft.subtasks}
        onChange={(subtasks) => patch({ subtasks })}
      />
      <div className="flex items-center gap-1.5 border-t px-3.5 py-2.5">
        <NewTaskChoices
          state={state}
          onModel={(model) => setPending((p) => ({ ...p, model }))}
          onEffort={(level) => setPending((p) => ({ ...p, level }))}
        />
        <span className="flex-1" />
        <Button variant="ghost" disabled={!ready} onClick={() => submit(false)}>
          Save for later
        </Button>
        <Button disabled={!ready} onClick={() => submit(true)}>
          <Play className="fill-current" />
          Start now
          <span className="text-[11px] opacity-55">{shortcut("↵")}</span>
        </Button>
      </div>
    </div>
  );
}
