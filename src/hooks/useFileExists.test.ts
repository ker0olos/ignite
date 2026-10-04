import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const fs = vi.hoisted(() => ({
  files: new Set<string>(),
  exists: vi.fn(async (path: string) => fs.files.has(path)),
}));
vi.mock("@tauri-apps/plugin-fs", () => ({ exists: fs.exists }));

let useFileExists: typeof import("./useFileExists").useFileExists;
beforeEach(async () => {
  vi.resetModules();
  fs.files = new Set(["/repo/a.ts"]);
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
