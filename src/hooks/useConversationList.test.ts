import { act, renderHook, waitFor } from "@testing-library/react";
import { mockWindows } from "@tauri-apps/api/mocks";
import { describe, expect, it, vi } from "vitest";
import type { AgentStatus, HostMessage } from "../../shared/hostProtocol";
import type { HostClient } from "@/lib/piHost";
import { fakeFs } from "@/test/fakeFs";
import { fakeStore } from "@/test/fakeStore";

const agent = (session: string, title = "", running = true): AgentStatus => ({
  cwd: "/a",
  session,
  title,
  running,
  waiting: false,
});

async function setup(saved: Record<string, unknown> = {}, remember = true) {
  const store = fakeStore(saved, null);
  mockWindows("main");
  fakeFs({}, store.handle);
  vi.resetModules();
  const { useConversationList } = await import("./useConversationList");
  const listeners = new Set<(m: HostMessage) => void>();
  const host = {
    subscribe: (cb: (m: HostMessage) => void) => {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
  } as unknown as HostClient;
  const push = (agents: AgentStatus[]) =>
    act(() => listeners.forEach((cb) => cb({ type: "agents", agents })));
  const hook = renderHook(() => useConversationList(host, remember));
  return { ...hook, push, store };
}

describe("useConversationList", () => {
  it("lists conversations as they start, and remembers them", async () => {
    const { result, push, store } = await setup();
    push([agent("1", "Fix it")]);
    expect(result.current.rows("/a")).toEqual([agent("1", "Fix it")]);
    await waitFor(() =>
      expect(store.data.get("conversations")).toEqual({
        "/a": [{ session: "1", title: "Fix it" }],
      }),
    );
  });

  it("keeps remembered conversations listed, idle until they run again", async () => {
    const { result } = await setup({
      conversations: { "/a": [{ session: "1", title: "Earlier" }] },
    });
    await waitFor(() =>
      expect(result.current.rows("/a")).toEqual([agent("1", "Earlier", false)]),
    );
  });

  it("remembers tags and filters rows by any selected tag", async () => {
    const { result, store } = await setup({
      conversations: {
        "/a": [
          { session: "1", title: "Bug" },
          { session: "2", title: "Design" },
        ],
      },
      conversation_tags: { "1": ["bug"], "2": ["design"], "9": ["closed"] },
    });
    await waitFor(() => expect(result.current.tags).toEqual(["bug", "design"]));
    act(() => result.current.toggleTagFilter("bug"));
    expect(result.current.rows("/a").map((r) => r.session)).toEqual(["1"]);
    act(() => result.current.setConversationTags("2", ["bug", "later"]));
    expect(result.current.rows("/a").map((r) => r.session)).toEqual(["1", "2"]);
    await waitFor(() =>
      expect(store.data.get("conversation_tags")).toMatchObject({
        "2": ["bug", "later"],
      }),
    );
  });

  it("keeps a closed conversation off the list, even when the app quits", async () => {
    const { result, push, store } = await setup();
    push([agent("1"), agent("2")]);
    act(() => result.current.forget("/a", "1"));
    // Quitting ends every session; the list stays as the user left it.
    push([]);
    expect(result.current.rows("/a").map((r) => r.session)).toEqual(["2"]);
    await waitFor(() =>
      expect(store.data.get("conversations")).toEqual({
        "/a": [{ session: "2", title: "" }],
      }),
    );
  });

  it("keeps a closed conversation off the list while the sidecar still reports it", async () => {
    const { result, push } = await setup();
    push([agent("1"), agent("2")]);
    act(() => result.current.forget("/a", "1"));
    push([agent("1"), agent("2")]);
    expect(result.current.rows("/a").map((r) => r.session)).toEqual(["2"]);
    // Once it's gone, reopening it lists it again.
    push([agent("2")]);
    push([agent("2"), agent("1")]);
    expect(result.current.rows("/a").map((r) => r.session)).toEqual(["2", "1"]);
  });

  it("remembers nothing when told not to", async () => {
    const { push, store } = await setup({}, false);
    push([agent("1")]);
    await new Promise((r) => setTimeout(r, 10));
    expect(store.sets.filter(([key]) => key === "conversations")).toEqual([]);
  });
});
