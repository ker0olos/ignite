import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AgentStatus, HostMessage } from "../../shared/hostProtocol";
import type { Task } from "../../shared/tasks";
import type { HostClient } from "@/lib/piHost";
import { useTasks } from "./useTasks";

const task: Task = {
  id: "t1",
  title: "Fix it",
  notes: "",
  images: [],
  subtasks: [],
  created: 1,
  updated: 1,
};

function fakeHost(answer: (req: { type: string }) => Promise<unknown>) {
  const listeners = new Set<(m: HostMessage) => void>();
  const host = {
    request: vi.fn(answer) as unknown as HostClient["request"],
    send: vi.fn(),
    subscribe: (cb: (m: HostMessage) => void) => {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
    close: vi.fn(),
  } satisfies HostClient;
  const emit = (m: HostMessage) => act(() => listeners.forEach((cb) => cb(m)));
  return Object.assign(host, { emit });
}

const requests = (host: ReturnType<typeof fakeHost>) =>
  vi
    .mocked(host.request)
    .mock.calls.map(([r]) => r as unknown as Record<string, unknown>);

describe("useTasks", () => {
  it("loads the tasks and applies pushes for its folder only", async () => {
    const host = fakeHost(async () => [task]);
    const { result } = renderHook(() => useTasks(host, "/p", []));
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));
    expect(result.current.tasks[0].status).toBe("todo");
    const next = { ...task, title: "New" };
    host.emit({ type: "tasks", cwd: "/other", tasks: [] });
    expect(result.current.tasks[0].title).toBe("Fix it");
    host.emit({ type: "tasks", cwd: "/p", tasks: [next] });
    expect(result.current.tasks[0].title).toBe("New");
  });

  it("saves then starts a task created to start now", async () => {
    const host = fakeHost(async (r) => (r.type === "tasks_list" ? [] : [task]));
    const { result } = renderHook(() => useTasks(host, "/p", []));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() =>
      result.current.create(
        { title: "A", notes: "", images: [], subtasks: [] },
        true,
      ),
    );
    const types = requests(host).map((r) => r.type);
    expect(types).toEqual(["tasks_list", "task_save", "task_start"]);
    const saved = requests(host)[1].task as Task;
    expect(requests(host)[2].taskId).toBe(saved.id);
  });

  it("only saves a task created for later", async () => {
    const host = fakeHost(async (r) => (r.type === "tasks_list" ? [] : [task]));
    const { result } = renderHook(() => useTasks(host, "/p", []));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() =>
      result.current.create(
        { title: "A", notes: "", images: [], subtasks: [] },
        false,
      ),
    );
    expect(requests(host).map((r) => r.type)).toEqual([
      "tasks_list",
      "task_save",
    ]);
  });

  it("starts a task in a conversation and shows it, or shows the failure", async () => {
    const host = fakeHost(async (r) => {
      if (r.type === "tasks_list") return [task];
      if ((r as { taskId?: string }).taskId === "bad") throw new Error("no");
      return [{ ...task, session: "s1", interactive: true }];
    });
    const { result } = renderHook(() => useTasks(host, "/p", []));
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));
    const open = vi.fn();
    await act(() => result.current.startInConversation("t1", open));
    expect(requests(host).at(-1)).toMatchObject({ interactive: true });
    expect(open).toHaveBeenCalledWith("s1");
    await act(() => result.current.startInConversation("bad", open));
    expect(result.current.error).toBe("no");
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("edits by sending only the patch", async () => {
    const host = fakeHost(async () => [task]);
    const { result } = renderHook(() => useTasks(host, "/p", []));
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));
    await act(() => result.current.edit("t1", { done: true }));
    expect(requests(host).at(-1)).toEqual({
      type: "task_edit",
      cwd: "/p",
      taskId: "t1",
      patch: { done: true },
    });
  });

  it("shows a failed request", async () => {
    const host = fakeHost(async (r) => {
      if (r.type === "tasks_list") return [task];
      throw new Error("disk full");
    });
    const { result } = renderHook(() => useTasks(host, "/p", []));
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));
    await act(() => result.current.remove("t1"));
    expect(result.current.error).toBe("disk full");
  });

  it("stops a started task's agent by its session, ignoring failures", async () => {
    const agents: AgentStatus[] = [];
    const started = { ...task, session: "s1" };
    const host = fakeHost(async (r) => {
      if (r.type === "abort") throw new Error("gone");
      return [started, task];
    });
    const { result } = renderHook(() => useTasks(host, "/p", agents));
    await waitFor(() => expect(result.current.tasks).toHaveLength(2));
    await act(() => result.current.stop("t1"));
    expect(requests(host).at(-1)).toEqual({ type: "abort", session: "s1" });
    expect(result.current.error).toBeNull();
  });

  it("does not stop a task that never started", async () => {
    const host = fakeHost(async () => [task]);
    const { result } = renderHook(() => useTasks(host, "/p", []));
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));
    await act(() => result.current.stop("t1"));
    expect(requests(host)).toHaveLength(1);
  });
});
