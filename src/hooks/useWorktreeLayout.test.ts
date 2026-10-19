import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { HostClient } from "@/lib/piHost";
import { cacheLayout, cachedLayout } from "@/lib/worktreeLayout";
import { useWorktreeLayout } from "./useWorktreeLayout";

beforeEach(() => localStorage.clear());

it("is the last known layout at once (a shared folder's null too), then the sidecar's, remembered", async () => {
  cacheLayout("/plain", null);
  cacheLayout("/app", { base: "/old", prefix: "" });
  const request = vi.fn(async () => ({ base: "/wt", prefix: "" }));
  const host = { request } as unknown as HostClient;
  const plain = renderHook(() => useWorktreeLayout(null, "/plain"));
  expect(plain.result.current).toBeNull();
  const app = renderHook(() => useWorktreeLayout(host, "/app"));
  expect(app.result.current).toEqual({ base: "/old", prefix: "" });
  await waitFor(() =>
    expect(app.result.current).toEqual({ base: "/wt", prefix: "" }),
  );
  expect(cachedLayout("/app")).toEqual({ base: "/wt", prefix: "" });
});

it("is unknown with no folder, or one never read", () => {
  expect(renderHook(() => useWorktreeLayout(null, null)).result.current).toBe(
    undefined,
  );
  expect(
    renderHook(() => useWorktreeLayout(null, "/new")).result.current,
  ).toBeUndefined();
});
