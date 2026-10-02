import { act, renderHook, waitFor } from "@testing-library/react";
import { emit } from "@tauri-apps/api/event";
import { mockWindows } from "@tauri-apps/api/mocks";
import { describe, expect, it, vi } from "vitest";
import { fakeFs } from "@/test/fakeFs";
import { fakeStore, STORE_PATH } from "@/test/fakeStore";

async function setup(saved: Record<string, unknown> = {}) {
  const store = fakeStore(saved, null);
  mockWindows("main");
  fakeFs({}, store.handle);
  vi.resetModules();
  const { useConversationTags } = await import("./useConversationTags");
  return { ...renderHook(() => useConversationTags()), store };
}

describe("useConversationTags", () => {
  it("loads saved tags", async () => {
    const { result } = await setup({ conversation_tags: { "1": ["bug"] } });
    await waitFor(() => expect(result.current.map).toEqual({ "1": ["bug"] }));
  });

  it("saves normalized tags, and clearing a conversation's removes its entry", async () => {
    const { result, store } = await setup();
    act(() => result.current.setTags("1", [" ui ", "bug"]));
    expect(result.current.map).toEqual({ "1": ["bug", "ui"] });
    await waitFor(() =>
      expect(store.data.get("conversation_tags")).toEqual({
        "1": ["bug", "ui"],
      }),
    );
    act(() => result.current.setTags("1", []));
    expect(result.current.map).toEqual({});
  });

  it("follows changes made in another window", async () => {
    const { result } = await setup({ conversation_tags: { "1": ["bug"] } });
    await waitFor(() => expect(result.current.map).toEqual({ "1": ["bug"] }));
    await act(() =>
      emit("store://change", {
        path: STORE_PATH,
        key: "conversation_tags",
        value: { "2": ["later"] },
      }),
    );
    await waitFor(() => expect(result.current.map).toEqual({ "2": ["later"] }));
  });

  it("keeps tags of a conversation that is no longer listed", async () => {
    const { result } = await setup();
    act(() => result.current.setTags("1", ["bug"]));
    act(() => result.current.setTags("2", ["ui"]));
    expect(result.current.map).toEqual({ "1": ["bug"], "2": ["ui"] });
  });

  it("toggles and clears the filter", async () => {
    const { result } = await setup();
    act(() => result.current.toggleFilter("bug"));
    act(() => result.current.toggleFilter("ui"));
    act(() => result.current.toggleFilter("bug"));
    expect(result.current.filter).toEqual(["ui"]);
    act(() => result.current.clearFilter());
    expect(result.current.filter).toEqual([]);
  });
});
