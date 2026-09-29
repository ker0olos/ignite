// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { runtimeFor } from "./sessionRuntime.ts";

const { AuthStorage } = await import(
  new URL(
    "./core/auth-storage.js",
    import.meta.resolve("@earendil-works/pi-coding-agent"),
  ).href
);

const model = {
  id: "m",
  name: "M",
  reasoning: false,
  input: ["text" as const],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 1000,
  maxTokens: 100,
};

describe("runtimeFor", () => {
  it("gives providers the session's cwd, and keeps each session's providers apart", async () => {
    const streamSimple = vi.fn(() => {
      throw new Error("stop");
    });
    const [a, b] = await Promise.all([
      runtimeFor(AuthStorage.inMemory(), "/work/a"),
      runtimeFor(AuthStorage.inMemory(), "/work/b"),
    ]);
    a.registerProvider("fake", {
      baseUrl: "fake",
      apiKey: "not-used",
      api: "fake",
      models: [model],
      streamSimple,
    });
    expect(b.getModel("fake", "m")).toBeUndefined();
    const m = a.getModel("fake", "m")!;
    await a
      .streamSimple(m, { messages: [] }, { maxTokens: 5 })
      .result()
      .catch(() => {});
    expect(streamSimple).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ cwd: "/work/a", maxTokens: 5 }),
    );
  });
});
