import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProviderStatus } from "../../shared/hostProtocol";
import { fakeFs } from "@/test/fakeFs";
import { fakeStore } from "@/test/fakeStore";

const none: ProviderStatus[] = [
  { id: "anthropic", connected: false },
  { id: "openai-codex", connected: false },
  { id: "openai", connected: false },
];
const oneConnected: ProviderStatus[] = [
  { id: "anthropic", connected: true, method: "oauth" },
  ...none.slice(1),
];

/**
 * Renders the hook against a fake store. store.ts opens the store at import
 * time, so the hook is imported fresh after the fake is installed.
 */
async function setup(
  saved: Record<string, unknown>,
  statuses: ProviderStatus[] | null,
  demo = false,
) {
  const store = fakeStore(saved);
  fakeFs({}, store.handle);
  vi.resetModules();
  const { useConnectScreen } = await import("./useConnectScreen");
  const hook = renderHook(({ s }) => useConnectScreen(s, demo), {
    initialProps: { s: statuses },
  });
  return { ...hook, store };
}

/** Lets the store read finish; the hook opens asynchronously, if at all. */
const settle = () => act(() => new Promise((r) => setTimeout(r, 10)));

describe("useConnectScreen", () => {
  it("opens on first launch when nothing is connected", async () => {
    const { result } = await setup({}, none);
    await waitFor(() => expect(result.current.open).toBe(true));
  });

  it("stays closed in demo mode, which needs no provider", async () => {
    const { result } = await setup({}, none, true);
    await settle();
    expect(result.current.open).toBe(false);
  });

  it("stays closed on first launch when a provider is connected", async () => {
    const { result } = await setup({}, oneConnected);
    await settle();
    expect(result.current.open).toBe(false);
  });

  it("stays closed once it has been dismissed before", async () => {
    const { result } = await setup({ connectScreenSeen: true }, none);
    await settle();
    expect(result.current.open).toBe(false);
  });

  it("waits for the statuses before deciding", async () => {
    const { result, rerender } = await setup({}, null);
    await settle();
    expect(result.current.open).toBe(false);
    rerender({ s: none });
    await waitFor(() => expect(result.current.open).toBe(true));
  });

  it("decides only once, even as statuses change", async () => {
    const { result, rerender } = await setup({}, oneConnected);
    await settle();
    rerender({ s: none });
    await settle();
    expect(result.current.open).toBe(false);
  });

  it("remembers a dismissal for every window", async () => {
    const { result, store } = await setup({}, none);
    await waitFor(() => expect(result.current.open).toBe(true));
    act(() => result.current.dismiss());
    expect(result.current.open).toBe(false);
    await waitFor(() => expect(store.data.get("connectScreenSeen")).toBe(true));
  });

  it("opens on request", async () => {
    const { result } = await setup({ connectScreenSeen: true }, oneConnected);
    act(() => result.current.show());
    expect(result.current.open).toBe(true);
  });
});
