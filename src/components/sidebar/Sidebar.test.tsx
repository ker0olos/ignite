import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { AgentStatus } from "../../../shared/hostProtocol";
import { fakeFs } from "@/test/fakeFs";
import { Sidebar } from "./Sidebar";

const row = (cwd: string, session: string, title: string): AgentStatus => ({
  cwd,
  session,
  title,
  running: false,
  waiting: false,
});
const ROWS: Record<string, AgentStatus[]> = {
  "/work/ignition": [row("/work/ignition", "a", "Fix the tree")],
  "/work/motr": [row("/work/motr", "b", "Sentry errors")],
};

const sidebar = (folders: string[], rows = ROWS) => {
  fakeFs({ "/work/ignition/a.txt": "" });
  render(
    <Sidebar
      folder="/work/ignition"
      actions={null}
      selected={null}
      onOpenFile={vi.fn()}
      hideGitIgnored={false}
      projectList={{
        folders,
        rows: (cwd) => rows[cwd] ?? [],
        shown: "a",
        conversations: {
          show: vi.fn(),
          create: vi.fn(),
          close: vi.fn(async () => {}),
          dismiss: vi.fn(),
          details: vi.fn(async () => null),
        },
        chatLimit: { enabled: false, max: 5 },
        home: "/home/me",
        onDismiss: vi.fn(),
        onHistory: vi.fn(),
        childActions: {
          activeTab: null,
          onOpenTab: vi.fn(),
          onStopBackground: vi.fn(),
          cleared: [],
          onClear: vi.fn(),
        },
        onOpenFolder: vi.fn(),
      }}
    />,
  );
};

it("lists every folder above the tree, each with its conversations", () => {
  sidebar(["/work/ignition", "/work/motr"]);
  expect(screen.getByText("motr")).toBeTruthy();
  expect(screen.getByText("Fix the tree")).toBeTruthy();
  expect(screen.getByText("Sentry errors")).toBeTruthy();
});

it("lists the folders even when there's one, with the open-folder button and no way back", () => {
  sidebar(["/work/ignition"], {});
  expect(
    screen.getByRole("button", { name: "Remove ignition from the sidebar" }),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Open Folder" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Projects" })).toBeNull();
});
