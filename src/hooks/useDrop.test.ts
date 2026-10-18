import { emit } from "@tauri-apps/api/event";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dropped } from "@/lib/drop";
import { addImageTarget } from "@/lib/imageTarget";
import { useDrop } from "./useDrop";

const sorted = vi.hoisted(() => ({
  value: { folders: [], images: [], files: [] } as Dropped,
}));
vi.mock("@/lib/drop", () => ({ sortDrop: async () => sorted.value }));
vi.mock("@/lib/dropPreview", async (actual) => ({
  ...(await actual<typeof import("@/lib/dropPreview")>()),
  peekDrop: async () => ({ folders: ["app"], images: [], files: ["a.pdf"] }),
}));

const position = { x: 0, y: 0 };

beforeEach(() => {
  mockWindows("main");
  mockIPC(() => null, { shouldMockEvents: true });
});

async function render() {
  const onFolder = vi.fn();
  const hook = renderHook(() => useDrop(onFolder));
  // Let the drag-drop listeners register before emitting.
  await act(async () => {});
  return { ...hook, onFolder };
}

const drop = () =>
  act(async () => {
    await emit("tauri://drag-drop", { paths: ["/x"], position });
    await new Promise((done) => setTimeout(done, 0));
  });

describe("useDrop", () => {
  it("shows what letting go does while a drag hovers, until it leaves", async () => {
    const remove = addImageTarget({
      label: "Add",
      add: vi.fn(),
      addFile: vi.fn(),
    });
    const { result } = await render();
    await act(async () => {
      await emit("tauri://drag-enter", {
        paths: ["/p/app", "/p/a.pdf"],
        position,
      });
      await new Promise((done) => setTimeout(done, 0));
    });
    expect(result.current?.kind).toBe("mixed");
    await act(() => emit("tauri://drag-leave", null));
    expect(result.current).toBeNull();
    remove();
  });

  it("leaves files out of the overlay where nothing takes them", async () => {
    const { result } = await render();
    await act(async () => {
      await emit("tauri://drag-enter", {
        paths: ["/p/app", "/p/a.pdf"],
        position,
      });
      await new Promise((done) => setTimeout(done, 0));
    });
    expect(result.current?.kind).toBe("folder");
  });

  it("opens dropped folders, last first, so the first ends up most recent", async () => {
    sorted.value = { folders: ["/first", "/second"], images: [], files: [] };
    const { result, onFolder } = await render();
    await drop();
    expect(onFolder.mock.calls.map(([path]) => path)).toEqual([
      "/second",
      "/first",
    ]);
    expect(result.current).toBeNull();
  });

  it("gives images and files to the input showing", async () => {
    const image = {
      type: "image" as const,
      data: "QQ==",
      mimeType: "image/png",
    };
    sorted.value = {
      folders: [],
      images: [{ image, name: "shot.png" }],
      files: [{ path: "/d/a.pdf" }],
    };
    const add = vi.fn();
    const addFile = vi.fn();
    const remove = addImageTarget({ label: "Add", add, addFile });
    await render();
    await drop();
    expect(add).toHaveBeenCalledWith(image, "shot.png");
    expect(addFile).toHaveBeenCalledWith({ path: "/d/a.pdf" });
    remove();
  });
});
