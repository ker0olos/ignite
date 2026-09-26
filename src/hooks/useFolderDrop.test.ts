import { emit } from "@tauri-apps/api/event";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFolderDrop } from "./useFolderDrop";

const position = { x: 0, y: 0 };

beforeEach(() => {
  mockWindows("main");
  mockIPC(() => null, { shouldMockEvents: true });
});

async function render() {
  const onDrop = vi.fn();
  const hook = renderHook(() => useFolderDrop(onDrop));
  // Let the drag-drop listeners register before emitting.
  await act(async () => {});
  return { ...hook, onDrop };
}

describe("useFolderDrop", () => {
  it("reports a drag hovering over the window", async () => {
    const { result } = await render();
    await act(() => emit("tauri://drag-enter", { paths: ["/a"], position }));
    expect(result.current).toBe(true);
  });

  it("stops reporting it when the drag leaves", async () => {
    const { result } = await render();
    await act(() => emit("tauri://drag-enter", { paths: ["/a"], position }));
    await act(() => emit("tauri://drag-leave", null));
    expect(result.current).toBe(false);
  });

  it("hands every dropped path over, last first, so the first ends up most recent", async () => {
    const { result, onDrop } = await render();
    await act(() => emit("tauri://drag-enter", { paths: [], position }));
    await act(() =>
      emit("tauri://drag-drop", { paths: ["/first", "/second"], position }),
    );
    expect(onDrop.mock.calls.map(([path]) => path)).toEqual([
      "/second",
      "/first",
    ]);
    expect(result.current).toBe(false);
  });
});
