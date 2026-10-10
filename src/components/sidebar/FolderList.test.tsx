import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { AgentStatus } from "../../../shared/hostProtocol";
import type { Conversations } from "@/hooks/useConversations";
import { childTabId } from "@/lib/childTabs";
import { FolderList } from "./FolderList";

const row = (cwd: string, session: string, title: string, running = false) => ({
  cwd,
  session,
  title,
  running,
  waiting: false,
});
const ROWS: Record<string, AgentStatus[]> = {
  "/proj": [row("/proj", "a", "Fix bug"), row("/proj", "b", "", true)],
  "/other": [
    {
      ...row("/other", "c", "Other work", true),
      subagents: [{ id: "agent-1", model: "haiku", running: true }],
      background: [
        { pid: 42, command: "npm run dev", running: true },
        { pid: 7, command: "npm run watch", running: false },
      ],
    },
  ],
};
const AGENT_TAB = childTabId({
  kind: "agent",
  session: "c",
  id: "agent-1",
  model: "haiku",
});

function setup(
  shown: string | null = "a",
  activeTab: string | null = null,
  conversationLimit = { enabled: false, max: 5 },
  rowMap = ROWS,
) {
  const conversations: Conversations = {
    show: vi.fn(),
    create: vi.fn(),
    close: vi.fn(async () => {}),
    dismiss: vi.fn(),
    details: vi.fn(async () => null),
  };
  const onDismiss = vi.fn();
  const childActions = {
    activeTab,
    onOpenTab: vi.fn(),
    onStopBackground: vi.fn(),
    onClear: vi.fn(),
    terminals: (cwd: string) => (cwd === "/other" ? ["t2"] : []),
    onOpenTerminal: vi.fn(),
    onStopTerminal: vi.fn(),
  };
  render(
    <FolderList
      folder="/proj"
      folders={["/proj", "/other", "/home/me/quiet"]}
      rows={(cwd) => rowMap[cwd] ?? []}
      shown={shown}
      conversations={conversations}
      conversationLimit={conversationLimit}
      home="/home/me"
      onDismiss={onDismiss}
      onHistory={vi.fn()}
      childActions={childActions}
    />,
  );
  return { conversations, onDismiss, childActions };
}

const selected = () =>
  screen
    .getAllByRole("button")
    .filter((b) => b.getAttribute("aria-current") === "true")
    .map((b) => b.textContent);

it("lists every folder by name, each followed by its conversations in order", () => {
  setup();
  const text = document.body.textContent ?? "";
  const order = [
    "other",
    "Other work",
    "proj",
    "Fix bug",
    "New conversation",
    "quiet",
  ];
  const at = order.map((s) => text.indexOf(s));
  expect(at.every((i) => i > -1)).toBe(true);
  expect([...at].sort((x, y) => x - y)).toEqual(at);
  expect(text).not.toContain("Recent");
  // The path shows on hover only.
  expect(text).not.toContain("~");
  expect(screen.getByTitle("~/quiet")).toBeTruthy();
});

it("selects the shown folder's shown conversation", () => {
  setup();
  expect(selected()).toEqual(["Fix bug"]);
});

it("selects the folder itself while it shows a new conversation", () => {
  setup(null);
  expect(selected()).toEqual(["proj"]);
});

it("shows a conversation when it's clicked, even in another folder", () => {
  const { conversations } = setup();
  fireEvent.click(screen.getByText("New conversation"));
  expect(conversations.show).toHaveBeenCalledWith("/proj", "b");
  fireEvent.click(screen.getByText("Other work"));
  expect(conversations.show).toHaveBeenCalledWith("/other", "c");
});

it("closes a conversation, passing the others in its folder", () => {
  const { conversations } = setup();
  fireEvent.click(screen.getByRole("button", { name: "Close Fix bug" }));
  expect(conversations.close).toHaveBeenCalledWith("/proj", "a", ["a", "b"]);
});

it("opens a new conversation in a folder when it's clicked", () => {
  const { conversations } = setup();
  fireEvent.click(screen.getByText("quiet"));
  expect(conversations.create).toHaveBeenCalledWith("/home/me/quiet");
});

it("takes a folder off the sidebar from its × button", () => {
  const { onDismiss, conversations } = setup();
  fireEvent.click(
    screen.getByRole("button", { name: "Remove other from the sidebar" }),
  );
  expect(onDismiss).toHaveBeenCalledWith("/other");
  expect(conversations.create).not.toHaveBeenCalled();
});

it("lists a conversation's subagents and background commands under it, opening each", () => {
  const { childActions } = setup();
  const text = document.body.textContent ?? "";
  const at = ["Other work", "agent-1", "npm run dev", "proj"].map((s) =>
    text.indexOf(s),
  );
  expect([...at].sort((x, y) => x - y)).toEqual(at);
  fireEvent.click(screen.getByText("agent-1"));
  expect(childActions.onOpenTab).toHaveBeenCalledWith("/other", "c", AGENT_TAB);
});

it("stops a running background command, not one that ended", () => {
  const { childActions } = setup();
  fireEvent.click(screen.getByRole("button", { name: "Stop npm run dev" }));
  expect(childActions.onStopBackground).toHaveBeenCalledWith("c", 42);
  expect(
    screen.queryByRole("button", { name: "Stop npm run watch" }),
  ).toBeNull();
  expect(screen.queryByRole("button", { name: "Stop agent-1" })).toBeNull();
});

it("lists a folder's running terminals, opening and stopping each", () => {
  const { childActions } = setup();
  fireEvent.click(screen.getByText("t2"));
  expect(childActions.onOpenTerminal).toHaveBeenCalledWith("/other", "t2");
  fireEvent.click(screen.getByRole("button", { name: "Stop Terminal" }));
  expect(childActions.onStopTerminal).toHaveBeenCalledWith("t2");
});

it("selects the row whose tab is active", () => {
  setup("a", AGENT_TAB);
  expect(selected()).toEqual(["agent-1haiku", "Fix bug"]);
});

const WATCH_TAB = childTabId({
  kind: "background",
  session: "c",
  pid: 7,
  command: "npm run watch",
});

it("clears a finished row, not a running one", () => {
  const { childActions } = setup("a", WATCH_TAB);
  fireEvent.click(screen.getByRole("button", { name: "Clear npm run watch" }));
  expect(childActions.onClear).toHaveBeenCalledWith(WATCH_TAB);
  expect(
    screen.queryByRole("button", { name: "Clear npm run dev" }),
  ).toBeNull();
  expect(screen.queryByRole("button", { name: "Clear agent-1" })).toBeNull();
});

it("hides finished rows unless their tab is active", () => {
  setup();
  expect(screen.queryByText("npm run watch")).toBeNull();
  expect(screen.getByText("agent-1")).toBeTruthy();
});

it("collapses conversations past the configured maximum and expands them", () => {
  const manyRows = {
    "/proj": [
      row("/proj", "a", "One"),
      row("/proj", "b", "Two"),
      row("/proj", "c", "Three"),
    ],
  };
  setup("a", null, { enabled: true, max: 2 }, manyRows);
  expect(screen.getByText("One")).toBeTruthy();
  expect(screen.getByText("Two")).toBeTruthy();
  expect(screen.queryByText("Three")).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Show 1 more conversations" }),
  );
  expect(screen.getByText("Three")).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Show fewer conversations" }),
  );
  expect(screen.queryByText("Three")).toBeNull();
});

it("keeps the selected conversation visible when it is past the collapsed maximum", () => {
  const manyRows = {
    "/proj": [
      row("/proj", "a", "One"),
      row("/proj", "b", "Two"),
      row("/proj", "c", "Three"),
    ],
  };
  setup("c", null, { enabled: true, max: 1 }, manyRows);
  expect(screen.getByText("One")).toBeTruthy();
  expect(screen.queryByText("Two")).toBeNull();
  expect(screen.getByText("Three")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Show 1 more conversations" }),
  ).toBeTruthy();
});
