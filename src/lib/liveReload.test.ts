import { afterEach, describe, expect, it, vi } from "vitest";
import { followLiveMods } from "./liveReload";

class FakeSource {
  static urls: string[] = [];
  onmessage: (() => void) | null = null;
  constructor(url: string) {
    FakeSource.urls.push(url);
    FakeSource.last = this;
  }
  static last: FakeSource | null = null;
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeSource.urls = [];
});

describe("followLiveMods", () => {
  it("listens to the launcher and reloads when it goes live", () => {
    vi.stubGlobal("EventSource", FakeSource);
    const reload = vi.fn();
    vi.stubGlobal("location", { reload });
    followLiveMods(true);
    expect(FakeSource.urls).toEqual(["/__ignite/live"]);
    FakeSource.last?.onmessage?.();
    expect(reload).toHaveBeenCalled();
  });

  it("does nothing outside a launcher build", () => {
    vi.stubGlobal("EventSource", FakeSource);
    followLiveMods(false);
    expect(FakeSource.urls).toEqual([]);
  });
});
