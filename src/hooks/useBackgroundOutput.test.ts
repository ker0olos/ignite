import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BackgroundOutput } from "../../shared/agentStatus";
import type { HostClient } from "@/lib/piHost";
import { useBackgroundOutput } from "./useBackgroundOutput";

const output = (running: boolean, text: string): BackgroundOutput => ({
  command: "npm run dev",
  running,
  output: text,
  truncated: false,
});

function fakeHost(replies: (BackgroundOutput | Error)[]) {
  const request = vi.fn(async (r: { type: string }) => {
    if (r.type === "background_stop") return true;
    const next = replies.length > 1 ? replies.shift()! : replies[0];
    if (next instanceof Error) throw next;
    return next;
  });
  return { host: { request } as unknown as HostClient, request };
}

afterEach(() => vi.useRealTimers());

describe("useBackgroundOutput", () => {
  it("reads the output again each second while it runs, then stops reading", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { host, request } = fakeHost([
      output(true, "up\n"),
      output(false, "up\nbye\n"),
    ]);
    const { result } = renderHook(() => useBackgroundOutput(host, "s", 42));
    await waitFor(() => expect(result.current.shown?.output).toBe("up\n"));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    await waitFor(() => expect(result.current.shown?.running).toBe(false));
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenCalledWith({
      type: "background_output",
      session: "s",
      pid: 42,
    });
  });

  it("shows why it can't be read", async () => {
    const { host } = fakeHost([new Error("No background command 42")]);
    const { result } = renderHook(() => useBackgroundOutput(host, "s", 42));
    await waitFor(() =>
      expect(result.current.error).toBe("No background command 42"),
    );
  });

  it("stops the command, then reads how it ended", async () => {
    const { host, request } = fakeHost([output(false, "up\n")]);
    const { result } = renderHook(() => useBackgroundOutput(host, "s", 42));
    await waitFor(() => expect(result.current.shown).not.toBeNull());
    await act(() => result.current.stop());
    expect(request).toHaveBeenCalledWith({
      type: "background_stop",
      session: "s",
      pid: 42,
    });
    await waitFor(() => expect(request).toHaveBeenCalledTimes(3));
  });

  it("waits for a host", () => {
    const { result } = renderHook(() => useBackgroundOutput(null, "s", 42));
    expect(result.current.shown).toBeNull();
  });
});
