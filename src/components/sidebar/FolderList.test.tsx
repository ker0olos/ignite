import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { AgentStatus } from "../../../shared/hostProtocol";
import type { Conversations } from "@/hooks/useConversations";
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
  "/other": [row("/other", "c", "Other work")],
};

function setup(shown: string | null = "a") {
  const conversations: Conversations = {
    show: vi.fn(),
    create: vi.fn(),
    close: vi.fn(async () => {}),
    dismiss: vi.fn(),
    history: vi.fn(async () => []),
  };
  const onDismiss = vi.fn();
  render(
    <FolderList
      folder="/proj"
      folders={["/proj", "/other", "/home/me/quiet"]}
      rows={(cwd) => ROWS[cwd] ?? []}
      shown={shown}
      conversations={conversations}
      home="/home/me"
      onDismiss={onDismiss}
    />,
  );
  return { conversations, onDismiss };
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
