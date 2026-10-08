import { useCallback, useEffect, useState } from "react";
import type { TodoItem } from "../../shared/tasks";
import type { HostClient } from "@/lib/piHost";

/** The open items of the .todo files in `cwd` and the folders directly in it, read when the folder shows; removing one edits its file. */
export function useTodos(host: HostClient | null, cwd: string) {
  const [loaded, setLoaded] = useState<{ cwd: string; items: TodoItem[] }>();
  useEffect(() => {
    if (!host) return;
    host
      .request({ type: "todo_list", cwd })
      .then((items) => setLoaded({ cwd, items }))
      .catch(() => setLoaded({ cwd, items: [] }));
  }, [host, cwd]);
  const remove = useCallback(
    async (item: TodoItem) => {
      const items = await host
        ?.request({ type: "todo_delete", cwd, item })
        .catch(() => undefined);
      if (items) setLoaded({ cwd, items });
    },
    [host, cwd],
  );
  return { items: loaded?.cwd === cwd ? loaded.items : [], remove };
}
