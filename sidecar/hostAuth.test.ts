// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { statusWithin } from "./hostAuth.ts";
import type { HostContext } from "./hostTypes.ts";

const ctxWith = (checkAuth: () => Promise<unknown>) =>
  ({ runtime: { checkAuth } }) as unknown as HostContext;

describe("statusWithin", () => {
  it("passes on a status that answers in time", async () => {
    const ctx = ctxWith(async () => ({ type: "api_key" }));
    expect(await statusWithin(ctx, "openai", 1000)).toEqual({
      id: "openai",
      connected: true,
      method: "api_key",
    });
  });

  it("reports disconnected when the check hangs", async () => {
    vi.useFakeTimers();
    const ctx = ctxWith(() => new Promise(() => {}));
    const result = statusWithin(ctx, "openai", 1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await result).toEqual({ id: "openai", connected: false });
    vi.useRealTimers();
  });
});
