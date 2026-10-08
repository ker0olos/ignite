import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { TodoItem } from "../../../shared/tasks";
import { TodoGroup } from "./TodoGroup";

const items: TodoItem[] = Array.from({ length: 12 }, (_, i) => ({
  folder: "server",
  section: "Ads",
  title: `Item ${i}`,
  notes: `Notes ${i}`,
}));

it("shows 10 items, then the rest on request", () => {
  render(
    <TodoGroup
      items={items}
      onAdd={vi.fn()}
      onStartInConversation={vi.fn()}
      onDelete={vi.fn()}
    />,
  );
  expect(screen.getByText("Item 9")).toBeTruthy();
  expect(screen.queryByText("Item 10")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Show 2 more" }));
  expect(screen.getByText("Item 11")).toBeTruthy();
});

it("opens an item to its section and notes, and adds it to the tasks", () => {
  const onAdd = vi.fn();
  const onStart = vi.fn();
  const onDelete = vi.fn();
  render(
    <TodoGroup
      items={items}
      onAdd={onAdd}
      onStartInConversation={onStart}
      onDelete={onDelete}
    />,
  );
  fireEvent.click(screen.getByText("Item 1"));
  expect(screen.getByText("Notes 1")).toBeTruthy();
  expect(screen.getByText("Ads")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Add to tasks" }));
  expect(onAdd).toHaveBeenCalledWith(items[1]);
  fireEvent.click(
    screen.getByRole("button", { name: "Start in conversation" }),
  );
  expect(onStart).toHaveBeenCalledWith(items[1]);
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(onDelete).toHaveBeenCalledWith(items[1]);
});

it("shows nothing without items", () => {
  const { container } = render(
    <TodoGroup
      items={[]}
      onAdd={vi.fn()}
      onStartInConversation={vi.fn()}
      onDelete={vi.fn()}
    />,
  );
  expect(container.innerHTML).toBe("");
});
