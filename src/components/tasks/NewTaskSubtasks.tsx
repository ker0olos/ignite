import { TaskStatusIcon } from "@/components/tasks/TaskStatusIcon";

/** The sheet's subtask inputs, plus an empty one that adds the next. */
export function NewTaskSubtasks({
  subtasks,
  onChange,
}: {
  subtasks: string[];
  onChange: (subtasks: string[]) => void;
}) {
  const set = (i: number, value: string) =>
    onChange(subtasks.map((s, j) => (j === i ? value : s)));
  return (
    <div className="flex flex-col gap-1.5 px-4 pb-3">
      <span className="text-[11px] font-semibold text-muted-foreground">
        Subtasks
      </span>
      {subtasks.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <TaskStatusIcon status="todo" />
          <input
            value={s}
            onChange={(e) => set(i, e.target.value)}
            spellCheck={false}
            className="flex-1 bg-transparent text-[13px] outline-none"
          />
        </div>
      ))}
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="w-3.5 text-center">+</span>
        <input
          value=""
          onChange={(e) => onChange([...subtasks, e.target.value])}
          placeholder="Add a subtask, or let the agent split it"
          spellCheck={false}
          className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
        />
      </div>
    </div>
  );
}
