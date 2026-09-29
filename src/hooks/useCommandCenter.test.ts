import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useCommandCenter } from "./useCommandCenter";

const press = (key: string, mods: Partial<KeyboardEventInit> = {}) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, ...mods }));
  });

describe("useCommandCenter", () => {
  it("opens on Cmd+K and closes on a second Cmd+K", () => {
    const { result } = renderHook(() => useCommandCenter());
    expect(result.current.open).toBe(false);
    press("k", { metaKey: true });
    expect(result.current.open).toBe(true);
    expect(result.current.query).toBe("");
    press("k", { metaKey: true });
    expect(result.current.open).toBe(false);
  });

  it("also opens and closes on Ctrl+K", () => {
    const { result } = renderHook(() => useCommandCenter());
    press("k", { ctrlKey: true });
    expect(result.current.open).toBe(true);
    press("K", { ctrlKey: true });
    expect(result.current.open).toBe(false);
  });

  it("opens with a given query through openWith", () => {
    const { result } = renderHook(() => useCommandCenter());
    act(() => result.current.openWith("sentry"));
    expect(result.current.open).toBe(true);
    expect(result.current.query).toBe("sentry");
  });

  it("bumps opening each time it opens, so a fresh open resets state", () => {
    const { result } = renderHook(() => useCommandCenter());
    const first = result.current.opening;
    act(() => result.current.openWith());
    expect(result.current.opening).toBe(first + 1);
    act(() => result.current.setOpen(false));
    act(() => result.current.openWith());
    expect(result.current.opening).toBe(first + 2);
  });

  it("ignores other keys and Cmd/Ctrl held with other keys", () => {
    const { result } = renderHook(() => useCommandCenter());
    press("j", { metaKey: true });
    expect(result.current.open).toBe(false);
    press("k");
    expect(result.current.open).toBe(false);
  });

  it("setOpen sets the open state directly", () => {
    const { result } = renderHook(() => useCommandCenter());
    act(() => result.current.setOpen(true));
    expect(result.current.open).toBe(true);
    act(() => result.current.setOpen(false));
    expect(result.current.open).toBe(false);
  });
});
