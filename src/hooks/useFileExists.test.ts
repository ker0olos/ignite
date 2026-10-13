import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const fs = vi.hoisted(() => ({
  files: new Set<string>(),
  exists: vi.fn(async (path: string) => fs.files.has(path)),
  stat: vi.fn(async (path: string) => {
    if (!fs.files.has(path)) throw new Error("missing");
    return { isFile: !path.endsWith("/dir") };
  }),
}));
vi.mock("@tauri-apps/plugin-fs", () => ({ exists: fs.exists, stat: fs.stat }));

let useFileExists: typeof import("./useFileExists").useFileExists;
beforeEach(async () => {
  vi.resetModules();
  fs.files = new Set(["/repo/a.ts", "/repo/dir"]);
  fs.exists.mockClear();
  ({ useFileExists } = await import("./useFileExists"));
});
afterEach(() => vi.useRealTimers());

it("is true once the path is found, and at once when mounted again", async () => {
  const first = renderHook(() => useFileExists("/repo/a.ts"));
  expect(first.result.current).toBe(false);
  await waitFor(() => expect(first.result.current).toBe(true));
  const again = renderHook(() => useFileExists("/repo/a.ts"));
  expect(again.result.current).toBe(true);
  expect(fs.exists).toHaveBeenCalledTimes(1);
});

it("is false for null without asking", () => {
  expect(renderHook(() => useFileExists(null)).result.current).toBe(false);
  expect(fs.exists).not.toHaveBeenCalled();
});

it("asks about a missing path again once a few seconds have passed", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  const missing = renderHook(() => useFileExists("/repo/new.ts"));
  await waitFor(() => expect(fs.exists).toHaveBeenCalledTimes(1));
  renderHook(() => useFileExists("/repo/new.ts"));
  expect(fs.exists).toHaveBeenCalledTimes(1);
  fs.files.add("/repo/new.ts");
  vi.setSystemTime(Date.now() + 6000);
  const later = renderHook(() => useFileExists("/repo/new.ts"));
  await waitFor(() => expect(later.result.current).toBe(true));
  expect(missing.result.current).toBe(false);
});

it("with filesOnly, is true for a file and false for a folder", async () => {
  const file = renderHook(() => useFileExists("/repo/a.ts", true));
  await waitFor(() => expect(file.result.current).toBe(true));
  const folder = renderHook(() => useFileExists("/repo/dir", true));
  await waitFor(() => expect(fs.stat).toHaveBeenCalledTimes(2));
  expect(folder.result.current).toBe(false);
  const anything = renderHook(() => useFileExists("/repo/dir"));
  await waitFor(() => expect(anything.result.current).toBe(true));
});
