import { useState } from "react";
import type { TodoItem } from "../../../shared/tasks";
import { ShowMoreButton } from "@/components/tasks/ShowMoreButton";
import { TaskGroupHeading } from "@/components/tasks/TaskGroupHeading";
import { TodoRow } from "@/components/tasks/TodoRow";
import { TASK_PAGE } from "@/lib/tasks";

/** The open items of the folder's .todo files, 10 at a time; hidden when there are none. */
export function TodoGroup({
  items,
  onAdd,
  onStartInConversation,
  onDelete,
}: {
  items: TodoItem[];
  onAdd: (item: TodoItem) => void;
  onStartInConversation: (item: TodoItem) => void;
  onDelete: (item: TodoItem) => void;
}) {
  const [shown, setShown] = useState(TASK_PAGE);
  const [openKey, setOpenKey] = useState<string | null>(null);
  if (items.length === 0) return null;
  const rows = items.slice(0, shown);
  const more = Math.min(TASK_PAGE, items.length - rows.length);
  return (
    <section>
      <TaskGroupHeading label="From .todo" count={items.length} />
      {rows.map((item, i) => {
        const key = `${i}\n${item.folder}\n${item.title}`;
        return (
          <TodoRow
            key={key}
            item={item}
            open={key === openKey}
            onToggle={() => setOpenKey(openKey === key ? null : key)}
            onAdd={() => onAdd(item)}
            onStartInConversation={() => onStartInConversation(item)}
            onDelete={() => onDelete(item)}
          />
        );
      })}
      {more > 0 && (
        <ShowMoreButton
          count={more}
          more
          onClick={() => setShown(shown + TASK_PAGE)}
        />
      )}
    </section>
  );
}
