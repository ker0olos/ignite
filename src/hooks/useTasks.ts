import { useCallback, useEffect, useMemo, useState } from "react";
import type { AgentStatus } from "../../shared/hostProtocol";
import type { Task, TaskEdit } from "../../shared/tasks";
import type { HostClient } from "@/lib/piHost";
import { taskFromDraft, withStatus, type TaskDraft } from "@/lib/tasks";

/**
 * The folder's tasks, kept current by the sidecar's pushes (other windows,
 * agents reporting progress), each with its status from `agents`, the
 * folder's conversations.
 */
export function useTasks(
  host: HostClient | null,
  cwd: string,
  agents: AgentStatus[],
) {
  const [loaded, setLoaded] = useState<{ cwd: string; tasks: Task[] } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!host) return;
    const off = host.subscribe((m) => {
      if (m.type === "tasks" && m.cwd === cwd)
        setLoaded({ cwd, tasks: m.tasks });
    });
    host
      .request({ type: "tasks_list", cwd })
      .then((tasks) => setLoaded({ cwd, tasks }))
      .catch((e: Error) => setError(e.message));
    return off;
  }, [host, cwd]);

  const run = useCallback(
    async (request: Promise<Task[]> | undefined) => {
      setError(null);
      try {
        const tasks = await request;
        if (tasks) setLoaded({ cwd, tasks });
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [cwd],
  );

  const tasks = useMemo(
    () => (loaded?.cwd === cwd ? loaded.tasks : []),
    [loaded, cwd],
  );
  const save = useCallback(
    (task: Task) =>
      run(
        host?.request({
          type: "task_save",
          cwd,
          task: { ...task, updated: Date.now() },
        }),
      ),
    [host, cwd, run],
  );
  const start = useCallback(
    (taskId: string) => run(host?.request({ type: "task_start", cwd, taskId })),
    [host, cwd, run],
  );

  return {
    tasks: useMemo(() => withStatus(tasks, agents), [tasks, agents]),
    loading: loaded?.cwd !== cwd,
    error,
    start,
    /** Changes a task's fields, e.g. `{ done: true }` or its notes. */
    edit: (taskId: string, patch: TaskEdit) =>
      run(host?.request({ type: "task_edit", cwd, taskId, patch })),
    /** Saves a new task from the sheet, and starts it when `now`; returns its id. */
    create: async (draft: TaskDraft, now: boolean) => {
      const task = taskFromDraft(draft);
      await save(task);
      if (now) await start(task.id);
      return task.id;
    },
    /** Starts a task in a conversation the user follows, and shows it with `open` once it's open. */
    startInConversation: async (
      taskId: string,
      open: (session: string) => void,
    ) => {
      setError(null);
      try {
        const tasks = await host?.request({
          type: "task_start",
          cwd,
          taskId,
          interactive: true,
        });
        if (!tasks) return;
        setLoaded({ cwd, tasks });
        const session = tasks.find((t) => t.id === taskId)?.session;
        if (session) open(session);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    /** Stops a started task's agent mid-run. */
    stop: async (taskId: string) => {
      const session = tasks.find((t) => t.id === taskId)?.session;
      if (session)
        await host?.request({ type: "abort", session }).catch(() => {});
    },
    remove: (taskId: string) =>
      run(host?.request({ type: "task_delete", cwd, taskId })),
    /** Approves or declines the pull request a task's agent waits on. */
    answer: (toolCallId: string, approved: boolean) =>
      host
        ?.send({ type: "approval_answer", toolCallId, approved })
        .catch((e: Error) => setError(e.message)),
    /** Tells a started task's agent what to change, and lets it carry on. */
    resume: (taskId: string, text: string) =>
      run(host?.request({ type: "task_resume", cwd, taskId, text })),
  };
}

type Tasks = ReturnType<typeof useTasks>;

/** What a task's row can do: the task actions, and opening its conversation. */
export type TaskActions = Pick<
  Tasks,
  | "start"
  | "startInConversation"
  | "stop"
  | "edit"
  | "remove"
  | "answer"
  | "resume"
> & {
  onOpenConversation: (session: string) => void;
};
