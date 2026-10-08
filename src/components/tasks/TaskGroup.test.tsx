import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import type { TaskActions } from "@/hooks/useTasks";
import type { ShownTask } from "@/lib/tasks";
import { TaskGroup } from "./TaskGroup";

const tasks: ShownTask[] = Array.from({ length: 12 }, (_, i) => ({
  id: `t${i}`,
  title: `Task ${i}`,
  notes: "",
  images: [],
  subtasks: [],
  created: i,
  updated: i,
  status: "done",
}));

const group = (paged: boolean) =>
  render(
    <TaskGroup
      label="Done"
      tasks={tasks}
      paged={paged}
      openId={null}
      onToggle={() => {}}
      actions={{} as TaskActions}
    />,
  );

it("hides a paged group's tasks until asked, then shows 10 more per click", () => {
  group(true);
  expect(screen.queryByText("Task 11")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Show 10" }));
  expect(screen.getByText("Task 11")).toBeTruthy();
  expect(screen.queryByText("Task 1")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Show 2 more" }));
  expect(screen.getByText("Task 0")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /^Show/ })).toBeNull();
});

it("shows every task of a group that isn't paged", () => {
  group(false);
  expect(screen.getByText("Task 0")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /^Show/ })).toBeNull();
});
