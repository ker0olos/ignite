import { describe, expect, it, vi } from "vitest";
import type { ModelInfo, SessionState } from "../../shared/hostProtocol";

const model = (id: string) => ({ provider: "p", id, name: id }) as ModelInfo;

const state = (
  id: string,
  models = [model("a"), model("b")],
): SessionState => ({
  models,
  model: model(id),
  thinkingLevel: "high",
  thinkingLevels: ["low", "high"],
  skills: [],
});

const fresh = async () => {
  vi.resetModules();
  return import("@/lib/sessionStateCache");
};

describe("sessionStateCache", () => {
  it("remembers each conversation's model and a new one's across launches", async () => {
    const cache = await fresh();
    cache.cacheState("s1", state("a"));
    cache.cacheState(null, state("b"));
    const later = await fresh();
    expect(later.cachedState("s1")).toEqual(state("a"));
    expect(later.cachedState(null)).toEqual(state("b"));
    expect(later.cachedState("s2")).toBeNull();
  });

  it("offers the newest models with each conversation's own choice", async () => {
    const cache = await fresh();
    cache.cacheState("s1", state("a"));
    const newer = [model("a"), model("c")];
    cache.cacheState("s2", state("c", newer));
    expect(cache.cachedState("s1")).toEqual(state("a", newer));
    expect(cache.cachedState("s1")).toBe(cache.cachedState("s1"));
  });

  it("leaves out skills, which may be another folder's", async () => {
    const cache = await fresh();
    const skills = [{ name: "deploy", description: "" }];
    cache.cacheState("s1", { ...state("a"), skills });
    expect(cache.cachedState("s1")?.skills).toEqual([]);
  });

  it("keeps the newest 200 conversations', and what another window saved", async () => {
    const mine = await fresh();
    for (let i = 0; i < 200; i++) mine.cacheState(`s${i}`, state("a"));
    (await fresh()).cacheState("other", state("b"));
    mine.cacheState("s0", state("b"));
    const later = await fresh();
    expect(later.cachedState("s1")).toBeNull();
    expect(later.cachedState("other")).toEqual(state("b"));
    expect(later.cachedState("s0")).toEqual(state("b"));
  });

  it("writes only a changed state", async () => {
    const cache = await fresh();
    cache.cacheState("s1", state("a"));
    const set = vi.spyOn(Storage.prototype, "setItem");
    cache.cacheState("s1", state("a"));
    expect(set).not.toHaveBeenCalled();
    set.mockRestore();
  });

  it("starts empty from unreadable storage, and keeps working without it", async () => {
    localStorage.setItem("session-state", "[not json");
    const cache = await fresh();
    expect(cache.cachedState("s1")).toBeNull();
    localStorage.setItem("session-state", "null");
    expect((await fresh()).cachedState("s1")).toBeNull();
    const set = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("full");
      });
    cache.cacheState("s1", state("a"));
    expect(cache.cachedState("s1")).toEqual(state("a"));
    set.mockRestore();
  });
});
