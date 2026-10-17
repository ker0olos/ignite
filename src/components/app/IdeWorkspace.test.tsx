import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProjectListProps } from "@/components/sidebar/FolderList";
import type { useTabs } from "@/hooks/useTabs";
import { IdeWorkspace } from "./IdeWorkspace";

// The panes and bars are the existing components; these tests cover the switching.
vi.mock("@/components/app/DesktopWorkspace", () => ({
  DesktopWorkspace: (p: { sidebar: ReactNode; agent: ReactNode }) => (
    <>
      {p.sidebar}
      {p.agent}
    </>
  ),
}));
vi.mock("@/components/app/IdeSideView", () => ({
  IdeSideView: (p: { view: string }) => <p>side: {p.view}</p>,
}));
vi.mock("@/components/app/IdeTopBar", () => ({ IdeTopBar: () => null }));
vi.mock("@/components/app/StatusBar", () => ({ StatusBar: () => null }));
vi.mock("@/components/app/IdeMain", () => ({
  IdeMain: (p: { view: string }) => <p>main: {p.view}</p>,
}));

const projectList = {
  folders: ["/f"],
  rows: () => [],
  shown: null,
  conversations: { create: vi.fn() },
} as unknown as ProjectListProps;

function setup(
  jetbrains: boolean,
  view: "conversation" | "tasks" = "conversation",
) {
  const onView = vi.fn();
  const onNewTerminal = vi.fn();
  const chrome = {
    menu: [],
    onSettings: vi.fn(),
    onSearch: vi.fn(),
    onSelectFolder: vi.fn(),
  };
  render(
    <IdeWorkspace
      jetbrains={jetbrains}
      chrome={chrome}
      view={view}
      onView={onView}
      onNewTerminal={onNewTerminal}
      side={{
        folder: "/f",
        projectList,
        host: null,
        selected: null,
        onOpenFile: vi.fn(),
        hideGitIgnored: true,
      }}
      agent={<p>agent</p>}
      gitStatus
      folder="/f"
      tabs={{} as ReturnType<typeof useTabs>}
      codeThemes={{} as never}
      editor={{ font_family: "", word_wrap: true }}
      session={{} as never}
      host={null}
      agentMinWidth={320}
    />,
  );
  return { onView, onNewTerminal, chrome };
}

describe("IdeWorkspace", () => {
  it("switches the side panel from the activity bar", () => {
    setup(false);
    expect(screen.getByText("side: conversations")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Files" }));
    expect(screen.getByText("side: files")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pull requests" }));
    expect(screen.getByText("side: pr")).toBeTruthy();
  });

  it("shows the main area for the view", () => {
    setup(false);
    expect(screen.getByText("main: conversation")).toBeTruthy();
  });

  it("toggles Tasks, and Conversations goes back to the conversation", () => {
    const { onView } = setup(false, "tasks");
    expect(screen.getByText("main: tasks")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tasks" }));
    expect(onView).toHaveBeenLastCalledWith("conversation");
    fireEvent.click(screen.getByRole("button", { name: "Conversations" }));
    expect(onView).toHaveBeenLastCalledWith("conversation");
  });

  it("marks only Tasks while it shows, and a side view leaves it", () => {
    const { onView } = setup(false, "tasks");
    const current = () =>
      screen
        .getAllByRole("button")
        .filter((b) => b.getAttribute("aria-current"))
        .map((b) => b.getAttribute("aria-label"));
    expect(current()).toEqual(["Tasks"]);
    fireEvent.click(screen.getByRole("button", { name: "Files" }));
    expect(onView).toHaveBeenLastCalledWith("conversation");
  });

  it("opens a terminal and, in VS Code's bar, Settings", () => {
    const { onNewTerminal, chrome } = setup(false);
    fireEvent.click(screen.getByRole("button", { name: "New terminal" }));
    expect(onNewTerminal).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(chrome.onSettings).toHaveBeenCalled();
  });

  it("labels JetBrains' buttons, with Settings in its top bar instead", () => {
    const { onView } = setup(true);
    expect(screen.getByText("Files")).toBeTruthy();
    expect(screen.getByText("PR")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Settings" })).toBeNull();
    fireEvent.click(screen.getByText("Tasks"));
    expect(onView).toHaveBeenCalledWith("tasks");
  });
});
