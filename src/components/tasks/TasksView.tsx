import { useState } from "react";
import type { AgentStatus } from "../../../shared/hostProtocol";
import { NewTaskDialog } from "@/components/tasks/NewTaskDialog";
import { NewTaskRow } from "@/components/tasks/NewTaskRow";
import { TaskGroup } from "@/components/tasks/TaskGroup";
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
  onOpenChat,
}: {
  folder: string;
  host: HostClient | null;
  agents: AgentStatus[];
  onOpenChat: (session: string) => void;
}) {
  const { tasks, error, create, ...rest } = useTasks(host, folder, agents);
  const [openId, setOpenId] = useState<string | null>(DEMO_OPEN_TASK);
  const [sheet, setSheet] = useNewTaskSheet();

  const add = (draft: TaskDraft, now: boolean) => {
    setSheet(false);
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
            actions={{ ...rest, onOpenChat }}
          />
        ))}
      </div>
      <NewTaskDialog
        host={host}
        open={sheet}
        onOpenChange={setSheet}
        onCreate={add}
      />
    </div>
  );
}
