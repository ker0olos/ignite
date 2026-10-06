import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SessionState } from "../../shared/hostProtocol";
import type { HostClient } from "@/lib/piHost";
import { useSessionEvents } from "./useSessionEvents";

type Listener = Parameters<HostClient["subscribe"]>[0];

function setup(request: () => Promise<unknown>) {
  let listener: Listener = () => {};
  const opened = {
    subscribe: (l: Listener) => {
      listener = l;
      return () => {};
    },
    request: vi.fn(request),
    send: vi.fn(),
  } as unknown as HostClient;
  const update = vi.fn();
  const onError = vi.fn();
  const setState = vi.fn();
  const shown = { current: "s1" as string | null };
  renderHook(() => useSessionEvents(opened, shown, update, onError, setState));
  const emit = (session: string, event: object) =>
    listener({ type: "session_event", session, event } as never);
  const ended = (session = "s1") =>
    emit(session, { type: "routing_end", sent: true });
  return { opened, update, onError, setState, emit, ended, shown };
}

describe("useSessionEvents after routing", () => {
  it("reads the shown conversation's model and effort again", async () => {
    const state = { model: { id: "m" } } as unknown as SessionState;
    const { opened, setState, ended } = setup(async () => state);
    ended();
    await waitFor(() => expect(setState).toHaveBeenCalledWith(state));
    expect(opened.request).toHaveBeenCalledWith({
      type: "session_state",
      session: "s1",
    });
  });

  it("drops the answer once another conversation shows", async () => {
    let answer!: (s: unknown) => void;
    const { opened, setState, ended, shown } = setup(
      () => new Promise((resolve) => (answer = resolve)),
    );
    ended();
    await waitFor(() => expect(opened.request).toHaveBeenCalled());
    shown.current = "s2";
    answer({});
    await Promise.resolve();
    expect(setState).not.toHaveBeenCalled();
  });

  it("reads nothing for other events or another conversation's routing", () => {
    const { opened, update, emit, ended } = setup(async () => ({}));
    emit("s1", { type: "agent_start" });
    expect(update).toHaveBeenCalled();
    ended("s2");
    expect(opened.request).not.toHaveBeenCalled();
  });

  it("reports a failed read", async () => {
    const { onError, ended } = setup(() => Promise.reject(new Error("gone")));
    ended();
    await waitFor(() => expect(onError).toHaveBeenCalledWith("gone"));
  });
});
