import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HostMessage } from "../../shared/hostProtocol";
import type { TerminalSnapshot } from "../../shared/terminal";
import type { HostClient } from "@/lib/piHost";
import { useTerminalSession, type TerminalIO } from "./useTerminalSession";

function setup(snapshot: Promise<TerminalSnapshot>) {
  let emit: (m: HostMessage) => void = () => {};
  const unsubscribe = vi.fn();
  const request = vi.fn((r: { type: string }) =>
    r.type === "terminal_snapshot" ? snapshot : Promise.resolve(undefined),
  );
  const host = {
    request,
    subscribe: (cb: (m: HostMessage) => void) => {
      emit = cb;
      return unsubscribe;
    },
  } as unknown as HostClient;
  let type: (d: string) => void = () => {};
  const dispose = vi.fn();
  const io: TerminalIO = {
    write: vi.fn(),
    onData: (cb) => {
      type = cb;
      return { dispose };
    },
  };
  return {
    host,
    io,
    request,
    unsubscribe,
    dispose,
    emit: (m: HostMessage) => emit(m),
    type: (d: string) => type(d),
  };
}

const data = (terminal: string, d: string): HostMessage => ({
  type: "terminal_data",
  terminal,
  data: d,
});

describe("useTerminalSession", () => {
  it("writes the snapshot, drops output that preceded it, then writes live output", async () => {
    let resolve!: (s: TerminalSnapshot) => void;
    const s = setup(new Promise((r) => (resolve = r)));
    renderHook(() => useTerminalSession(s.host, "t1", s.io));
    s.emit(data("t1", "early"));
    resolve({ screen: "SNAP" });
    await waitFor(() => expect(s.io.write).toHaveBeenCalledWith("SNAP"));
    s.emit(data("t1", "live"));
    s.emit(data("t2", "other"));
    expect(vi.mocked(s.io.write).mock.calls).toEqual([["SNAP"], ["live"]]);
  });

  it("sends keystrokes as input until the shell exits", async () => {
    const s = setup(Promise.resolve({ screen: "" }));
    renderHook(() => useTerminalSession(s.host, "t1", s.io));
    s.type("ls\r");
    expect(s.request).toHaveBeenCalledWith({
      type: "terminal_input",
      terminal: "t1",
      data: "ls\r",
    });
    await waitFor(() => expect(s.io.write).toHaveBeenCalledWith(""));
    s.emit({ type: "terminal_exit", terminal: "t1", exitCode: 2 });
    expect(s.io.write).toHaveBeenLastCalledWith(
      expect.stringContaining("[exited 2]"),
    );
    s.request.mockClear();
    s.type("x");
    expect(s.request).not.toHaveBeenCalled();
  });

  it("writes an exit that came before the snapshot after it", async () => {
    let resolve!: (s: TerminalSnapshot) => void;
    const s = setup(new Promise((r) => (resolve = r)));
    renderHook(() => useTerminalSession(s.host, "t1", s.io));
    s.emit({ type: "terminal_exit", terminal: "t1", exitCode: 0 });
    expect(s.io.write).not.toHaveBeenCalled();
    resolve({ screen: "SNAP" });
    await waitFor(() => expect(s.io.write).toHaveBeenCalledTimes(2));
    expect(vi.mocked(s.io.write).mock.calls[1][0]).toContain("[exited 0]");
  });

  it("marks a shell that exited while no view showed it", async () => {
    const s = setup(Promise.resolve({ screen: "SNAP", exitCode: 1 }));
    renderHook(() => useTerminalSession(s.host, "t1", s.io));
    await waitFor(() =>
      expect(s.io.write).toHaveBeenLastCalledWith(
        expect.stringContaining("[exited 1]"),
      ),
    );
    s.type("x");
    expect(s.request).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "terminal_input" }),
    );
  });

  it("shows a failed snapshot in the surface", async () => {
    const s = setup(Promise.reject(new Error("no such terminal")));
    renderHook(() => useTerminalSession(s.host, "t1", s.io));
    await waitFor(() =>
      expect(s.io.write).toHaveBeenCalledWith(
        expect.stringContaining("no such terminal"),
      ),
    );
  });

  it("detaches on unmount without closing the terminal", () => {
    const s = setup(Promise.resolve({ screen: "" }));
    const { unmount } = renderHook(() =>
      useTerminalSession(s.host, "t1", s.io),
    );
    unmount();
    expect(s.unsubscribe).toHaveBeenCalled();
    expect(s.dispose).toHaveBeenCalled();
    expect(s.request).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "terminal_close" }),
    );
  });
});
