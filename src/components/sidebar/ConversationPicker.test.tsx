import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, expect, it, vi } from "vitest";
import type { SavedSession } from "../../../shared/hostProtocol";
import { ConversationPicker } from "./ConversationPicker";

// cmdk measures and scrolls its list, which jsdom can't.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView ??= () => {};
});

const saved = (id: string, title: string): SavedSession => ({
  id,
  title,
  modified: Date.now(),
  messageCount: 2,
  open: false,
});

const picker = (list: SavedSession[] | null) => {
  const onShow = vi.fn();
  render(
    <ConversationPicker
      open
      onOpenChange={() => {}}
      folderName="motr"
      saved={list}
      onShow={onShow}
    />,
  );
  return onShow;
};

it("searches the folder's closed conversations and reopens the one picked", () => {
  const onShow = picker([
    saved("a", "check the latest sentry errors"),
    saved("b", "add a dark mode"),
  ]);
  const search = screen.getByPlaceholderText("Search conversations in motr");
  fireEvent.change(search, { target: { value: "sentry" } });
  expect(screen.queryByText("add a dark mode")).toBeNull();
  fireEvent.click(screen.getByText("check the latest sentry errors"));
  expect(onShow).toHaveBeenCalledWith("a");
});

it("says when nothing matches the search", () => {
  picker([saved("a", "sentry")]);
  fireEvent.change(
    screen.getByPlaceholderText("Search conversations in motr"),
    {
      target: { value: "zzz" },
    },
  );
  expect(screen.getByText("No conversations match.")).toBeTruthy();
});

it("says when a folder has no closed conversations", () => {
  picker([]);
  expect(screen.getByText("No previous conversations in motr.")).toBeTruthy();
});

it("shows it's loading until the list arrives", () => {
  picker(null);
  expect(screen.getByText("Loading…")).toBeTruthy();
});
