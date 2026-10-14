import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SessionState } from "../../shared/hostProtocol";
import type { HostClient } from "@/lib/piHost";
import { fromHistory, type Transcript } from "@/lib/transcript";
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
    send: vi.fn(async () => {}),
  } as unknown as HostClient;
  const apply = vi.fn();
  const onError = vi.fn();
  const setState = vi.fn();
  const { result } = renderHook(() =>
    useSessionEvents(opened, () => "s1", apply, onError, setState),
  );
  const emit = (session: string, event: object) =>
    listener({ type: "session_event", session, event } as never);
  const ended = (session = "s1") =>
    emit(session, { type: "routing_end", sent: true });
  return { opened, apply, onError, setState, emit, ended, answer: result };
}

describe("useSessionEvents", () => {
  it("applies each conversation's events to its own transcript", () => {
    const { apply, emit } = setup(async () => ({}));
    emit("s2", { type: "agent_start" });
    expect(apply).toHaveBeenCalledWith("s2", expect.any(Function));
    const f = apply.mock.calls[0][1] as (t: Transcript) => Transcript;
    expect(f(fromHistory([], false)).running).toBe(true);
  });

  it("settles an answered call in the shown conversation", () => {
    const { apply, opened, answer } = setup(async () => ({}));
    answer.current("call", true);
    expect(apply).toHaveBeenCalledWith("s1", expect.any(Function));
    expect(opened.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "approval_answer", toolCallId: "call" }),
    );
  });
});

describe("useSessionEvents after routing", () => {
  it("reads the routed conversation's model and effort again", async () => {
    const state = { model: { id: "m" } } as unknown as SessionState;
    const { opened, setState, ended } = setup(async () => state);
    ended("s2");
    await waitFor(() => expect(setState).toHaveBeenCalledWith(state, "s2"));
    expect(opened.request).toHaveBeenCalledWith({
      type: "session_state",
      session: "s2",
    });
  });

  it("reads nothing for other events", () => {
    const { opened, emit } = setup(async () => ({}));
    emit("s1", { type: "agent_start" });
    expect(opened.request).not.toHaveBeenCalled();
  });

  it("reports a failed read", async () => {
    const { onError, ended } = setup(() => Promise.reject(new Error("gone")));
    ended();
    await waitFor(() => expect(onError).toHaveBeenCalledWith("gone"));
  });
});
