// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { claudeLoggedIn, status, statusWithin } from "./hostAuth.ts";
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

describe("claudeLoggedIn", () => {
  const claude = (loggedIn: boolean) => {
    const check = vi.fn(async () => ({ installed: true, loggedIn }));
    const ctx = {
      claudeLogin: null,
      local: { claudeCode: { status: check } },
    } as unknown as HostContext;
    return { ctx, check };
  };

  it("checks once, then answers from memory", async () => {
    const { ctx, check } = claude(true);
    expect(await claudeLoggedIn(ctx)).toBe(true);
    expect(await claudeLoggedIn(ctx)).toBe(true);
    expect(check).toHaveBeenCalledOnce();
  });

  it("checks again behind an old answer, which the next call gets", async () => {
    vi.useFakeTimers();
    const { ctx, check } = claude(true);
    await claudeLoggedIn(ctx);
    check.mockResolvedValue({ installed: true, loggedIn: false });
    vi.advanceTimersByTime(31_000);
    expect(await claudeLoggedIn(ctx)).toBe(true);
    await vi.waitFor(() => expect(check).toHaveBeenCalledTimes(2));
    expect(await claudeLoggedIn(ctx)).toBe(false);
    vi.useRealTimers();
  });

  it("takes the answer of every fresh check, like the providers' status", async () => {
    const { ctx } = claude(false);
    expect(await status(ctx, "claude-code")).toMatchObject({
      connected: false,
    });
    expect(ctx.claudeLogin).toMatchObject({ loggedIn: false });
  });
});
