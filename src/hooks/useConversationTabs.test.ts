import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { fakeFs } from "@/test/fakeFs";
import type { useAgentSession } from "@/hooks/useAgentSession";
import type { Conversations } from "@/hooks/useConversations";
import { childTabId } from "@/lib/childTabs";
import { cacheLayout } from "@/lib/worktreeLayout";
import type { HostClient } from "@/lib/piHost";
import { useConversationTabs } from "./useConversationTabs";

type Props = {
  session: string | null;
  workdir?: string | null;
  listed?: string[];
  forksOf?: Record<string, string[]>;
  started?: { folder: string; session: string; workdir: string } | null;
};

// The sidecar answers nothing here: the layout stays as cached, and no terminals are listed.
const host = {
  request: vi.fn(async (r: { type: string }) =>
    r.type === "terminal_list" ? [] : undefined,
  ),
  subscribe: () => () => {},
} as unknown as HostClient;

function setup() {
  const conversations = {
    show: vi.fn(),
    close: vi.fn(async () => {}),
    dismiss: vi.fn(),
  } as unknown as Conversations;
  const hook = renderHook(
    ({
      session,
      workdir = session && `/wt/${session}`,
      listed = ["s1", "s2"],
      forksOf = {},
      started = null,
    }: Props) =>
      useConversationTabs(
        host,
        "/work",
        ["/work"],
        {
          session,
          none: session === null,
          workdir,
          started,
        } as unknown as ReturnType<typeof useAgentSession>,
        conversations,
        vi.fn(),
        () =>
          listed.map((session) => ({
            session,
            forks: (forksOf[session] ?? []).map((f) => ({ session: f })),
          })),
      ),
    { initialProps: { session: "s1" } as Props },
  );
  return { conversations, ...hook };
}

const terminalTab = (terminal: string) =>
  childTabId({ kind: "terminal", session: "", terminal });

it("opens a found file from the worktree, or the folder's copy when the worktree has none", async () => {
  fakeFs({ "/wt/s1/a.ts": "", "/work/a.ts": "", "/work/notes.md": "" });
  const { result } = setup();
  act(() => result.current.openFile("/work", "a.ts"));
  act(() => result.current.openFile("/work", "notes.md"));
  await waitFor(() =>
    expect(result.current.tabs.files).toEqual([
      "/wt/s1/a.ts",
      "/work/notes.md",
    ]),
  );
});

it("drops a conversation's tabs once it closed, and a dismissed folder's", async () => {
  const { result, conversations } = setup();
  act(() => result.current.tabs.open("/wt/s1/a.ts"));
  await act(() => result.current.conversations.close("/work", "s1", []));
  expect(result.current.tabs.isOpen("/wt/s1/a.ts")).toBe(false);
  expect(conversations.close).toHaveBeenCalledWith("/work", "s1", []);

  act(() => result.current.tabs.open("/wt/s1/b.ts"));
  act(() => result.current.conversations.dismiss("/work"));
  expect(result.current.tabs.isOpen("/wt/s1/b.ts")).toBe(false);
  expect(conversations.dismiss).toHaveBeenCalledWith("/work");
});

it("knows a conversation's root before it opens, from the folder's worktree layout", () => {
  cacheLayout("/work", { base: "/wt", prefix: "" });
  const { result, rerender } = setup();
  rerender({ session: "s2", workdir: null });
  expect(result.current.shown).toEqual({ session: "s2", root: "/wt/s2" });
  rerender({ session: null });
  expect(result.current.shown.root).toBe("/work");
  localStorage.clear();
});

it("drops the tabs of a conversation that left the list some other way", () => {
  const { result, rerender } = setup();
  act(() => result.current.tabs.open("/wt/s1/a.ts"));
  rerender({ session: "s2" });
  rerender({ session: "s2", listed: ["s2"] });
  expect(result.current.tabs.isOpen("/wt/s1/a.ts")).toBe(false);
});

it("gives the tabs opened before the first message to the conversation it started", async () => {
  fakeFs({ "/wt/s3/a.ts": "" });
  const { result, rerender } = setup();
  rerender({ session: null });
  act(() => result.current.tabs.open("/work/a.ts"));
  const started = { folder: "/work", session: "s3", workdir: "/wt/s3" };
  rerender({ session: "s3", listed: ["s1", "s2", "s3"], started });
  await waitFor(() =>
    expect(result.current.tabs.files).toEqual(["/wt/s3/a.ts"]),
  );
});

it("opens a terminal's tab in the open conversation that has it, showing that one", () => {
  const { result, rerender, conversations } = setup();
  const tab = terminalTab("term-1");
  act(() => result.current.tabs.open(tab));
  act(() => result.current.tabs.open("/wt/s1/a.ts"));
  rerender({ session: "s2" });
  act(() => result.current.openTerminal("/work", "term-1"));
  expect(conversations.show).toHaveBeenCalledWith("/work", "s1");
  expect(result.current.tabs.files).toEqual([]);
  rerender({ session: "s1" });
  expect(result.current.tabs.active).toBe(tab);

  // One no conversation has opens in the shown one.
  act(() => result.current.openTerminal("/work", "term-2"));
  expect(conversations.show).toHaveBeenCalledTimes(1);
  expect(result.current.tabs.active).toBe(terminalTab("term-2"));
});

it("never reopens a closed conversation to show a terminal", () => {
  const { result, rerender, conversations } = setup();
  act(() => result.current.tabs.open(terminalTab("term-1")));
  rerender({ session: "s2" });
  // s1 is no longer listed, but its close didn't go through the sidebar (its tabs stay until the list effect).
  rerender({ session: "s2", listed: [] });
  act(() => result.current.openTerminal("/work", "term-1"));
  expect(conversations.show).not.toHaveBeenCalled();
  expect(result.current.tabs.active).toBe(terminalTab("term-1"));
});

it("hands a started conversation the tabs only once, so the next new conversation keeps its own", () => {
  const { result, rerender } = setup();
  const started = { folder: "/work", session: "s1", workdir: "/wt/s1" };
  rerender({ session: "s1", started });
  rerender({ session: null, started });
  act(() => result.current.tabs.open("child:term"));
  // The same start seen again (an effect run twice).
  rerender({ session: null, started: { ...started } });
  expect(result.current.tabs.files).toEqual(["child:term"]);
});

it("looks for ignored files in the started conversation's worktree again once they're copied in", async () => {
  fakeFs({});
  const { result, rerender } = setup();
  rerender({ session: null });
  act(() => result.current.tabs.open("/work/.env"));
  let ready = () => {};
  const copied = new Promise<void>((resolve) => (ready = resolve));
  act(() => result.current.tabs.adopt("/work", "s3", "/wt/s3", copied));
  rerender({ session: "s3", listed: ["s1", "s2", "s3"] });
  await waitFor(() =>
    expect(result.current.tabs.files).toEqual(["/work/.env"]),
  );
  fakeFs({ "/wt/s3/.env": "" });
  ready();
  await waitFor(() =>
    expect(result.current.tabs.files).toEqual(["/wt/s3/.env"]),
  );
});

it("keeps the tabs of a fork, which the list shows under its original", () => {
  const { result, rerender } = setup();
  rerender({ session: "f1", listed: ["s1"], forksOf: { s1: ["f1"] } });
  act(() => result.current.tabs.open("/wt/f1/a.ts"));
  rerender({ session: "s1", listed: ["s1"], forksOf: { s1: ["f1"] } });
  expect(result.current.tabs.isOpen("/wt/f1/a.ts")).toBe(true);
});
