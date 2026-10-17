import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { ProjectListProps } from "@/components/sidebar/FolderList";
import { closeFrontTab } from "@/hooks/useFrontTabClose";
import type { useTabs } from "@/hooks/useTabs";
import { WorkspaceTabs } from "./WorkspaceTabs";

function setup(
  active: string | null,
  { files = ["/f/app.ts"], hidden = [] as string[], shown = "a" } = {},
) {
  const conversations = { show: vi.fn(), create: vi.fn() };
  const projectList = {
    rows: () => [
      { session: "a", title: "Add dark mode" },
      { session: "b", title: "", forks: [{ session: "fk", title: "Try it" }] },
    ],
    shown,
    conversations,
  } as unknown as ProjectListProps;
  const tabs = {
    files,
    active,
    activate: vi.fn(),
    close: vi.fn(),
  } as unknown as ReturnType<typeof useTabs>;
  const onHide = vi.fn();
  render(
    <WorkspaceTabs
      folder="/f"
      projectList={projectList}
      tabs={tabs}
      files={files}
      front={active && files.includes(active) ? active : null}
      hidden={hidden}
      onHide={onHide}
    />,
  );
  return { conversations, tabs, onHide };
}

const current = () =>
  screen.getAllByTitle(/./).find((t) => t.hasAttribute("data-active"))?.title;
const close = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name: `Close ${name}` }));

it("lists the conversations and their forks, then the files, the front one marked", () => {
  setup(null);
  expect(current()).toBe("Add dark mode");
  expect(screen.getByText("New conversation")).toBeTruthy();
  expect(screen.getByText("Try it")).toBeTruthy();
  expect(screen.getByText("app.ts")).toBeTruthy();
});

it("marks the file while it's in front", () => {
  setup("/f/app.ts");
  expect(current()).toBe("app.ts");
});

it("gives the shown conversation a tab even when the rows leave it out", () => {
  setup(null, { shown: "filtered" });
  expect(screen.getAllByText("New conversation")).toHaveLength(2);
});

it("puts a conversation in front, leaving the files open", () => {
  const { conversations, tabs } = setup("/f/app.ts");
  fireEvent.click(screen.getByText("Try it"));
  expect(tabs.activate).toHaveBeenCalledWith(null);
  expect(conversations.show).toHaveBeenCalledWith("/f", "fk");
});

it("puts a file in front", () => {
  const { tabs } = setup(null);
  fireEvent.click(screen.getByText("app.ts"));
  expect(tabs.activate).toHaveBeenCalledWith("/f/app.ts");
});

it("only hides a conversation's tab, the shown one's too", () => {
  const { onHide } = setup("/f/app.ts");
  close("Add dark mode");
  expect(onHide).toHaveBeenCalledWith("a");
  cleanup();
  setup("/f/app.ts", { hidden: ["a"] });
  expect(screen.queryByText("Add dark mode")).toBeNull();
});

it("gives the front conversation's place to the next conversation", () => {
  const { conversations } = setup(null);
  close("Add dark mode");
  expect(conversations.show).toHaveBeenCalledWith("/f", "b");
});

it("goes back to the conversation behind the last file", () => {
  const { conversations, tabs } = setup("/f/app.ts");
  close("app.ts");
  expect(tabs.close).toHaveBeenCalledWith("/f/app.ts");
  expect(tabs.activate).toHaveBeenLastCalledWith(null);
  expect(conversations.show).not.toHaveBeenCalled();
});

it("opens an empty conversation once the last tab closes", () => {
  const { conversations } = setup(null, { files: [], hidden: ["b", "fk"] });
  close("Add dark mode");
  expect(conversations.create).toHaveBeenCalledWith("/f");
});

it("closes the front tab on ⌘W", () => {
  const { tabs } = setup("/f/app.ts");
  expect(closeFrontTab()).toBe(false);
  expect(tabs.close).toHaveBeenCalledWith("/f/app.ts");
});
