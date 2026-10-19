import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { fakeFs } from "@/test/fakeFs";
import type { useAgentSession } from "@/hooks/useAgentSession";
import type { Conversations } from "@/hooks/useConversations";
import { childTabId } from "@/lib/childTabs";
import { useConversationTabs } from "./useConversationTabs";

type Props = {
  session: string | null;
  listed?: string[];
  started?: { folder: string; session: string; workdir: string } | null;
};

function setup() {
  const conversations = {
    show: vi.fn(),
    close: vi.fn(async () => true),
    dismiss: vi.fn(),
  } as unknown as Conversations;
  const hook = renderHook(
    ({ session, listed = ["s1", "s2"], started = null }: Props) =>
      useConversationTabs(
        null,
        "/work",
        ["/work"],
        {
          session,
          none: session === null,
          root: session ? `/wt/${session}` : "/work",
          started,
        } as unknown as ReturnType<typeof useAgentSession>,
        conversations,
        vi.fn(),
        () => listed.map((session) => ({ session })),
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
  expect(result.current.tabs.everyFile).toEqual([]);
  expect(conversations.close).toHaveBeenCalledWith("/work", "s1", []);

  act(() => result.current.tabs.open("/wt/s1/b.ts"));
  act(() => result.current.conversations.dismiss("/work"));
  expect(result.current.tabs.everyFile).toEqual([]);
  expect(conversations.dismiss).toHaveBeenCalledWith("/work");
});

it("keeps a conversation's tabs when closing it failed, even as it leaves the list", async () => {
  const { result, rerender, conversations } = setup();
  // The sidecar takes a while to end it, then fails.
  let fail = () => {};
  vi.mocked(conversations.close).mockImplementationOnce(
    () => new Promise((resolve) => (fail = () => resolve(false))),
  );
  act(() => result.current.tabs.open("/wt/s1/a.ts"));
  let closing: Promise<boolean> = Promise.resolve(true);
  act(() => {
    closing = result.current.conversations.close("/work", "s1", []);
  });
  rerender({ session: "s1", listed: ["s2"] });
  await act(async () => {
    fail();
    await closing;
  });
  expect(result.current.tabs.everyFile).toEqual(["/wt/s1/a.ts"]);
});

it("drops the tabs of a conversation that left the list some other way", () => {
  const { result, rerender } = setup();
  act(() => result.current.tabs.open("/wt/s1/a.ts"));
  rerender({ session: "s2" });
  rerender({ session: "s2", listed: ["s2"] });
  expect(result.current.tabs.everyFile).toEqual([]);
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
