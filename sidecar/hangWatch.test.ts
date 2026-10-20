import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHangWatch, webkitPids } from "./hangWatch.ts";

describe("webkitPids", () => {
  it("lists the running page and GPU processes, not templates or networking", () => {
    const listing = [
      "\t\t   90299      - \tcom.apple.WebKit.WebContent.EFA3042A-738E",
      "\t\t       0      - \tcom.apple.WebKit.WebContent",
      "\t\t       0      - \tcom.apple.WebKit.GPU",
      "\t\t   90300      - \tcom.apple.WebKit.Networking.4C0576A0",
      "\t\t   90298      - \tcom.apple.WebKit.GPU.1D59D377",
      "\t\t       0      - \tcom.apple.WebKit.WebContent.0000",
    ].join("\n");
    expect(webkitPids(listing)).toEqual([90299, 90298]);
  });
});

describe("createHangWatch", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("samples once when a visible page goes quiet for 10 seconds", () => {
    const sample = vi.fn(() => Promise.resolve());
    const beat = createHangWatch(sample, "darwin", new EventEmitter());
    beat(true);
    vi.advanceTimersByTime(9000);
    expect(sample).not.toHaveBeenCalled();
    vi.advanceTimersByTime(30_000);
    expect(sample).toHaveBeenCalledTimes(1);
    beat(true);
    vi.advanceTimersByTime(11_000);
    expect(sample).toHaveBeenCalledTimes(2);
  });

  it("keeps quiet while the page beats, is hidden, or the Mac slept", () => {
    const sample = vi.fn(() => Promise.resolve());
    const beat = createHangWatch(sample, "darwin", new EventEmitter());
    for (let i = 0; i < 20; i++) {
      beat(true);
      vi.advanceTimersByTime(1000);
    }
    beat(false);
    vi.advanceTimersByTime(30_000);
    beat(true);
    vi.setSystemTime(Date.now() + 60_000);
    vi.advanceTimersByTime(1000);
    expect(sample).not.toHaveBeenCalled();
  });

  it("keeps quiet once the app closes the sidecar's input", () => {
    const sample = vi.fn(() => Promise.resolve());
    const input = new EventEmitter();
    createHangWatch(sample, "darwin", input)(true);
    input.emit("end");
    vi.advanceTimersByTime(30_000);
    expect(sample).not.toHaveBeenCalled();
  });

  it("does nothing off macOS", () => {
    const sample = vi.fn(() => Promise.resolve());
    createHangWatch(sample, "linux", new EventEmitter())(true);
    vi.advanceTimersByTime(30_000);
    expect(sample).not.toHaveBeenCalled();
  });
});
