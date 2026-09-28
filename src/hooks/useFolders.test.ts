import { emit } from "@tauri-apps/api/event";
import { mockWindows } from "@tauri-apps/api/mocks";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { fakeFs } from "@/test/fakeFs";
import { STORE_PATH, fakeStore } from "@/test/fakeStore";

/**
 * Renders useFolders in a window with the given label against a fake store.
 * The hook and the store module read the window label and open the store at
 * import time, so they are imported fresh after the fakes are installed.
 */
async function setup({
  label = "main",
  saved = {},
  picked = null,
  demo = null,
  tree = { "/a": null, "/b": null },
}: {
  label?: string;
  saved?: Record<string, unknown>;
  picked?: string | null;
  demo?: string | null;
  tree?: Record<string, null>;
} = {}) {
  const store = fakeStore(saved, picked);
  mockWindows(label);
  fakeFs(tree, store.handle);
  vi.resetModules();
  const { useFolders } = await import("./useFolders");
  const hook = renderHook(() => useFolders(demo));
  await waitFor(() => expect(hook.result.current.loaded).toBe(true));
  return { ...hook, store };
}

const savedState = { folders: ["/a", "/b"], current: "/b" };

describe("useFolders", () => {
  describe("on load", () => {
    it("restores recent folders and the open folder in the main window", async () => {
      const { result } = await setup({ saved: savedState });
      expect(result.current.folders).toEqual(["/a", "/b"]);
      expect(result.current.current).toBe("/b");
    });

    it("doesn't reopen a folder that no longer exists", async () => {
      const { result } = await setup({ saved: savedState, tree: {} });
      expect(result.current.folders).toEqual(["/a", "/b"]);
      expect(result.current.current).toBeNull();
    });

    it("restores recent folders but opens nothing in extra windows", async () => {
      const { result } = await setup({ label: "window-1", saved: savedState });
      expect(result.current.folders).toEqual(["/a", "/b"]);
      expect(result.current.current).toBeNull();
    });

    it("opens the demo folders in demo mode without remembering them", async () => {
      const { result, store } = await setup({
        saved: savedState,
        demo: "/repo/demo/tempo",
      });
      expect(result.current.current).toBe("/repo/demo/tempo");
      expect(result.current.projects).toEqual([
        "/repo/demo/pantry",
        "/repo/demo/tempo",
      ]);
      await new Promise((r) => setTimeout(r, 10));
      expect(store.sets.filter(([key]) => key === "current")).toEqual([]);
      expect(store.data.get("current")).toBe("/b");
    });

    it("starts empty on first launch", async () => {
      const { result } = await setup();
      expect(result.current.folders).toEqual([]);
      expect(result.current.current).toBeNull();
    });
  });

  describe("addFolder", () => {
    it("opens the folder, moves it to the front and saves the list", async () => {
      const { result, store } = await setup({ saved: savedState });
      act(() => result.current.addFolder("/b"));
      await waitFor(() => expect(result.current.folders).toEqual(["/b", "/a"]));
      expect(result.current.current).toBe("/b");
      expect(store.data.get("folders")).toEqual(["/b", "/a"]);
    });
  });

  describe("open projects", () => {
    it("keeps each opened folder open, including the restored one", async () => {
      const { result } = await setup({ saved: savedState });
      expect(result.current.projects).toEqual(["/b"]);
      act(() => result.current.addFolder("/a"));
      act(() => result.current.addFolder("/b"));
      expect(result.current.projects).toEqual(["/b", "/a"]);
    });

    it("closes a hidden project, keeping the shown one", async () => {
      const { result } = await setup({ saved: savedState });
      act(() => result.current.addFolder("/a"));
      act(() => result.current.closeFolder("/b"));
      expect(result.current.current).toBe("/a");
      expect(result.current.projects).toEqual(["/a"]);
    });

    it("shows the last opened project after closing the shown one", async () => {
      const { result } = await setup({
        saved: { folders: ["/a", "/b", "/c"] },
      });
      act(() => result.current.addFolder("/a"));
      act(() => result.current.addFolder("/b"));
      act(() => result.current.addFolder("/c"));
      act(() => result.current.addFolder("/b"));
      act(() => result.current.closeFolder());
      expect(result.current.current).toBe("/c");
      act(() => result.current.closeFolder());
      act(() => result.current.closeFolder());
      expect(result.current.current).toBeNull();
      expect(result.current.projects).toEqual([]);
    });

    it("closes projects dropped from the recent list", async () => {
      const { result } = await setup({ saved: savedState });
      act(() => result.current.clearFolders());
      expect(result.current.projects).toEqual([]);
    });
  });

  describe("openFolder", () => {
    it("adds the folder picked in the dialog", async () => {
      const { result } = await setup({ picked: "/picked" });
      await act(() => result.current.openFolder());
      expect(result.current.current).toBe("/picked");
      expect(result.current.folders).toEqual(["/picked"]);
    });

    it("changes nothing when the dialog is cancelled", async () => {
      const { result, store } = await setup({
        saved: savedState,
        picked: null,
      });
      await act(() => result.current.openFolder());
      expect(result.current.current).toBe("/b");
      expect(store.sets.filter(([key]) => key === "folders")).toEqual([]);
    });
  });

  describe("closeFolder", () => {
    it("closes the open folder but keeps it in the recent list", async () => {
      const { result } = await setup({ saved: savedState });
      act(() => result.current.closeFolder());
      expect(result.current.current).toBeNull();
      expect(result.current.folders).toEqual(["/a", "/b"]);
    });
  });

  describe("clearFolders", () => {
    it("empties and saves the list, closing the open folder", async () => {
      const { result, store } = await setup({ saved: savedState });
      act(() => result.current.clearFolders());
      await waitFor(() => expect(result.current.current).toBeNull());
      expect(result.current.folders).toEqual([]);
      expect(store.data.get("folders")).toEqual([]);
    });
  });

  describe("persisting the open folder", () => {
    it("saves it from the main window", async () => {
      const { result, store } = await setup({ saved: savedState });
      act(() => result.current.addFolder("/c"));
      await waitFor(() => expect(store.data.get("current")).toBe("/c"));
    });

    it("never saves it from extra windows, so they don't overwrite the main one", async () => {
      const { result, store } = await setup({
        label: "window-1",
        saved: savedState,
      });
      act(() => result.current.addFolder("/c"));
      await waitFor(() => expect(result.current.current).toBe("/c"));
      expect(store.sets.filter(([key]) => key === "current")).toEqual([]);
    });
  });

  describe("changes from other windows", () => {
    it("updates the recent list", async () => {
      const { result } = await setup({ saved: savedState });
      await act(() =>
        emit("store://change", {
          path: STORE_PATH,
          key: "folders",
          value: ["/z", "/b"],
        }),
      );
      expect(result.current.folders).toEqual(["/z", "/b"]);
      expect(result.current.current).toBe("/b");
    });

    it("closes the open folder when another window removes it", async () => {
      const { result } = await setup({ saved: savedState });
      await act(() =>
        emit("store://change", { path: STORE_PATH, key: "folders", value: [] }),
      );
      expect(result.current.current).toBeNull();
    });

    it("treats a deleted list as empty", async () => {
      const { result } = await setup({ saved: savedState });
      await act(() =>
        emit("store://change", { path: STORE_PATH, key: "folders" }),
      );
      expect(result.current.folders).toEqual([]);
      expect(result.current.current).toBeNull();
    });

    it("ignores changes to other keys", async () => {
      const { result } = await setup({ saved: savedState });
      await act(() =>
        emit("store://change", {
          path: STORE_PATH,
          key: "current",
          value: "/a",
        }),
      );
      expect(result.current.current).toBe("/b");
    });
  });
});
