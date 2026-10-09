import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AgentStatus, HostMessage } from "../../shared/hostProtocol";
import type { HostClient } from "@/lib/piHost";
import { useForkWait } from "./useForkWait";

describe("useForkWait", () => {
  it("follows whether the conversation waits on a fork", () => {
    let push: (m: HostMessage) => void = () => {};
    const host = {
      subscribe: (cb: typeof push) => ((push = cb), () => {}),
    } as unknown as HostClient;
    const status = (waitingOnFork: boolean): AgentStatus => ({
      cwd: "/a",
      session: "1",
      title: "",
      running: false,
      waiting: false,
      waitingOnFork,
    });
    const { result } = renderHook(() => useForkWait(host, "1"));
    expect(result.current).toBe(false);
    act(() => push({ type: "agents", agents: [status(true)] }));
    expect(result.current).toBe(true);
    act(() => push({ type: "agents", agents: [status(false)] }));
    expect(result.current).toBe(false);
  });
});
