import { emit } from "@tauri-apps/api/event";
import { mockIPC } from "@tauri-apps/api/mocks";
import { beforeEach, describe, expect, it, vi } from "vitest";

// store.ts calls load() at import time, so the fake backend must exist first.
let onStoreChange: typeof import("./store").onStoreChange;
beforeEach(async () => {
  mockIPC(() => 1, { shouldMockEvents: true });
  vi.resetModules();
  ({ onStoreChange } = await import("./store"));
});

describe("onStoreChange", () => {
  it("reports changes to the app's store file from any window", async () => {
    const cb = vi.fn();
    await onStoreChange(cb);
    await emit("store://change", {
      path: "/Users/me/Library/Application Support/app/state.json",
      key: "folders",
      value: ["/a"],
    });
    expect(cb).toHaveBeenCalledWith("folders", ["/a"]);
  });

  it("ignores changes to other store files", async () => {
    const cb = vi.fn();
    await onStoreChange(cb);
    await emit("store://change", {
      path: "/elsewhere/other.json",
      key: "folders",
      value: [],
    });
    expect(cb).not.toHaveBeenCalled();
  });
});
