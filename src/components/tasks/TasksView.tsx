import { useState } from "react";
import type { AgentStatus } from "../../../shared/hostProtocol";
import type { TaskImage } from "../../../shared/tasks";
import type { ModelRouter } from "@/components/agent/Composer";
import { NewTaskDialog } from "@/components/tasks/NewTaskDialog";
import { NewTaskRow } from "@/components/tasks/NewTaskRow";
import { TaskGroup } from "@/components/tasks/TaskGroup";
import { useProvideImageTarget } from "@/hooks/useImageTarget";
import { useNewTaskSheet } from "@/hooks/useNewTaskSheet";
import { useTasks } from "@/hooks/useTasks";
import { DEMO_OPEN_TASK } from "@/lib/demo";
import type { HostClient } from "@/lib/piHost";
import { TASK_GROUPS, tasksLead, type TaskDraft } from "@/lib/tasks";

/** The folder's tasks as one checklist: rows open in place. */
export function TasksView({
  folder,
  host,
  agents,
  modelRouter,
  onOpenConversation,
}: {
  folder: string;
  host: HostClient | null;
  agents: AgentStatus[];
  modelRouter?: ModelRouter;
  onOpenConversation: (session: string) => void;
}) {
  const { tasks, error, create, ...rest } = useTasks(host, folder, agents);
  const [openId, setOpenId] = useState<string | null>(DEMO_OPEN_TASK);
  const [sheet, setSheet] = useNewTaskSheet();
  const [seed, setSeed] = useState<TaskImage[]>([]);
  // With the sheet closed, a marked-up image starts a new task.
  useProvideImageTarget("Add to new task", (image, name) => {
    setSeed([{ ...image, name }]);
    setSheet(true);
  });
  const sheetChange = (open: boolean) => {
    setSheet(open);
    if (!open) setSeed([]);
  };

  const add = (draft: TaskDraft, now: boolean) => {
    sheetChange(false);
    void create(draft, now);
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div data-tauri-drag-region className="h-9" />
      <div className="always-bounce mx-auto max-w-[680px] px-8 pb-[60px]">
        <h1 className="text-[26px] font-bold tracking-tight">Tasks</h1>
        <p className="mt-1 mb-6 text-[13px] text-muted-foreground">
          {tasksLead(tasks)}
        </p>
        {error && (
          <p className="-mt-4 mb-4 text-[13px] text-destructive">{error}</p>
        )}
        <NewTaskRow onClick={() => setSheet(true)} />
        {TASK_GROUPS.map(({ label, statuses }) => (
          <TaskGroup
            key={label}
            label={label}
            tasks={tasks.filter((t) => statuses.includes(t.status))}
            openId={openId}
            onToggle={(id) => setOpenId(openId === id ? null : id)}
            actions={{ ...rest, onOpenConversation }}
          />
        ))}
      </div>
      <NewTaskDialog
        host={host}
        open={sheet}
        images={seed}
        modelRouter={modelRouter}
        onOpenChange={sheetChange}
        onCreate={add}
      />
    </div>
  );
}
