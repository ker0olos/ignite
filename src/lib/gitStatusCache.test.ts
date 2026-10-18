import { describe, expect, it, vi } from "vitest";
import type { GitRepoStatus } from "../../shared/git";

const status = (name: string): GitRepoStatus => ({
  repo: `/${name}`,
  name,
  changed: 0,
  unpushed: 1,
});

const fresh = async () => {
  vi.resetModules();
  return import("@/lib/gitStatusCache");
};

describe("gitStatusCache", () => {
  it("remembers a conversation's repositories across launches", async () => {
    (await fresh()).cacheGitStatus("s1", [status("a")]);
    const later = await fresh();
    expect(later.cachedGitStatus("s1")).toEqual([status("a")]);
    expect(later.cachedGitStatus("s2")).toBeUndefined();
  });

  it("keeps the newest 200 conversations', a re-read one counting as new", async () => {
    const cache = await fresh();
    for (let i = 0; i < 200; i++) cache.cacheGitStatus(`s${i}`, []);
    cache.cacheGitStatus("s0", [status("again")]);
    cache.cacheGitStatus("s200", []);
    const later = await fresh();
    expect(later.cachedGitStatus("s1")).toBeUndefined();
    expect(later.cachedGitStatus("s0")).toEqual([status("again")]);
    expect(later.cachedGitStatus("s200")).toEqual([]);
  });

  it("starts empty from unreadable storage, and keeps working without it", async () => {
    localStorage.setItem("git-status", "[not json");
    const cache = await fresh();
    expect(cache.cachedGitStatus("s1")).toBeUndefined();
    localStorage.setItem("git-status", "[]");
    expect((await fresh()).cachedGitStatus("0")).toBeUndefined();
    const set = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("full");
      });
    cache.cacheGitStatus("s1", [status("a")]);
    expect(cache.cachedGitStatus("s1")).toEqual([status("a")]);
    set.mockRestore();
  });
});
