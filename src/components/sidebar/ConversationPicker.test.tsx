import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, expect, it, vi } from "vitest";
import type {
  SavedSession,
  SessionDetails,
} from "../../../shared/conversations";
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

const picker = (
  list: SavedSession[] | null,
  details: Record<string, SessionDetails | null> = {},
) => {
  const onShow = vi.fn();
  const onHighlight = vi.fn();
  render(
    <ConversationPicker
      open
      onOpenChange={() => {}}
      folderName="motr"
      saved={list}
      details={details}
      onHighlight={onHighlight}
      onShow={onShow}
    />,
  );
  return Object.assign(onShow, { onHighlight });
};

it("searches the folder's closed conversations and reopens the one picked", () => {
  const onShow = picker([
    saved("a", "check the latest sentry errors"),
    saved("b", "add a dark mode"),
  ]);
  const search = screen.getByPlaceholderText("Search conversations in motr");
  fireEvent.change(search, { target: { value: "sentry" } });
  expect(screen.queryByText("add a dark mode")).toBeNull();
  fireEvent.click(
    screen.getByRole("option", { name: /check the latest sentry errors/ }),
  );
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

it("shows the highlighted conversation's details beside the list", () => {
  const { onHighlight } = picker(
    [saved("a", "check the latest sentry errors"), saved("b", "dark mode")],
    {
      a: {
        model: "claude-opus-5-5",
        files: ["src/sentry.ts"],
        toolCalls: 12,
        cost: 1.5,
        branch: "fix/sentry",
        summary: { completed: "Fixed two issues", nextSteps: "Open a PR" },
      },
    },
  );
  expect(onHighlight).toHaveBeenCalledWith("a");
  expect(screen.getByText("Fixed two issues")).toBeTruthy();
  expect(screen.getByText("Open a PR")).toBeTruthy();
  expect(screen.getByText("src/sentry.ts")).toBeTruthy();
  expect(
    screen.getByText(
      /claude-opus-5-5 · 2 messages · 12 tool calls · \$1\.50 · fix\/sentry/,
    ),
  ).toBeTruthy();
});

it("shows the last reply when cmem has no summary", () => {
  picker([saved("a", "sentry")], {
    a: { lastReply: "Both issues are fixed.", files: [], toolCalls: 0 },
  });
  expect(screen.getByText("Both issues are fixed.")).toBeTruthy();
  expect(screen.queryByText("Last done")).toBeNull();
});
