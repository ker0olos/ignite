import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  HostMessage,
  ProviderStatus,
  SessionState,
} from "../../shared/hostProtocol";
import type { HostClient } from "@/lib/piHost";
import { fromHistory } from "@/lib/transcript";
import { useAgentSession } from "./useAgentSession";

const opus = { provider: "anthropic", id: "opus", name: "Opus" };
const mini = { provider: "openai", id: "mini", name: "Mini" };
const STATE: SessionState = {
  models: [opus, mini],
  model: opus,
  thinkingLevel: "low",
  thinkingLevels: ["off", "low", "high"],
};
const STATUSES: ProviderStatus[] = [{ id: "anthropic", connected: true }];

/**
 * A fake sidecar client answering each request type with `answer`. Opened
 * sessions start empty unless the answer says otherwise; `emit` plays a
 * message from the sidecar.
 */
function fakeHost(answer: (req: { type: string }) => Promise<unknown>) {
  const listeners = new Set<(m: HostMessage) => void>();
  const host = {
    request: vi.fn(async (req: { type: string }) => {
      const data = await answer(req);
      return req.type === "open_session"
        ? { messages: [], running: false, approvals: [], ...(data as object) }
        : data;
    }) as unknown as HostClient["request"],
    send: vi.fn(async () => {}),
    subscribe: (cb: (m: HostMessage) => void) => {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
    close: vi.fn(),
  } satisfies HostClient;
  const emit = (m: HostMessage) => act(() => listeners.forEach((cb) => cb(m)));
  return Object.assign(host, { emit, listeners });
}

const types = (host: HostClient) =>
  vi.mocked(host.request).mock.calls.map(([r]) => r.type);

describe("useAgentSession", () => {
  it("reports the folder's trust and saves the user's answer", async () => {
    const host = fakeHost(async (req) =>
      req.type === "open_session" ? { ...STATE, trust: "ask" } : undefined,
    );
    const { result } = renderHook(() => useAgentSession(host, "/work", null));
    await waitFor(() => expect(result.current.trust).toBe("ask"));
    expect(result.current.state).toEqual(STATE);
    await act(() => result.current.setTrust(true));
    expect(result.current.trust).toBe("trusted");
    expect(host.request).toHaveBeenCalledWith({
      type: "set_trust",
      cwd: "/work",
      trusted: true,
    });
    await act(() => result.current.setTrust(false));
    expect(result.current.trust).toBe("untrusted");
  });

  it("drops an error when another folder is shown", async () => {
    const host = fakeHost(async (req) =>
      req.type === "set_trust"
        ? Promise.reject(new Error("Disk full"))
        : { ...STATE, trust: "ask" },
    );
    const { result, rerender } = renderHook(
      ({ folder }) => useAgentSession(host, folder, null),
      { initialProps: { folder: "/work" } },
    );
    await waitFor(() => expect(result.current.trust).toBe("ask"));
    await act(() => result.current.setTrust(true));
    expect(result.current.error).toBe("Disk full");
    rerender({ folder: "/other" });
    expect(result.current.error).toBeNull();
  });

  it("shows why trust couldn't be saved", async () => {
    const host = fakeHost(async (req) =>
      req.type === "set_trust"
        ? Promise.reject(new Error("Disk full"))
        : { ...STATE, trust: "ask" },
    );
    const { result } = renderHook(() => useAgentSession(host, "/work", null));
    await waitFor(() => expect(result.current.trust).toBe("ask"));
    await act(() => result.current.setTrust(true));
    expect(result.current.error).toBe("Disk full");
  });

  it("does nothing with trust or approvals before the session opens", () => {
    const host = fakeHost(() => new Promise(() => {}));
    const { result } = renderHook(() => useAgentSession(host, "/work", null));
    expect(result.current.trust).toBeNull();
    void result.current.setTrust(true);
    result.current.answer("c1", true);
    expect(types(host)).toEqual(["open_session"]);
    expect(host.send).not.toHaveBeenCalled();
  });

  it("shows a tool call waiting for approval and sends the answer", async () => {
    const host = fakeHost(async () => STATE);
    const { result } = renderHook(() => useAgentSession(host, "/work", null));
    await waitFor(() => expect(result.current.state).toEqual(STATE));
    host.emit({
      type: "approval_request",
      request: { toolCallId: "c1", reason: "Kills processes by name" },
    });
    expect(result.current.transcript?.tools.c1).toEqual({
      status: "running",
      approval: { reason: "Kills processes by name" },
    });
    act(() => result.current.answer("c1", false));
    expect(result.current.transcript?.tools.c1.approval).toBeUndefined();
    expect(host.send).toHaveBeenCalledWith({
      type: "approval_answer",
      toolCallId: "c1",
      approved: false,
    });
  });

  it("shows why an approval couldn't be sent", async () => {
    const host = fakeHost(async () => STATE);
    host.send.mockRejectedValueOnce(new Error("The agent host stopped."));
    const { result } = renderHook(() => useAgentSession(host, "/work", null));
    await waitFor(() => expect(result.current.state).toEqual(STATE));
    act(() => result.current.answer("c1", true));
    await waitFor(() =>
      expect(result.current.error).toBe("The agent host stopped."),
    );
  });

  it("opens a session for the folder", async () => {
    const host = fakeHost(async () => STATE);
    const { result } = renderHook(() =>
      useAgentSession(host, "/work", STATUSES),
    );
    await waitFor(() => expect(result.current.state).toEqual(STATE));
    expect(host.request).toHaveBeenCalledWith({
      type: "open_session",
      cwd: "/work",
    });
  });

  it("does nothing without a sidecar or a folder", () => {
    const host = fakeHost(async () => STATE);
    renderHook(() => useAgentSession(host, null, STATUSES));
    const { result } = renderHook(() =>
      useAgentSession(null, "/work", STATUSES),
    );
    expect(host.request).not.toHaveBeenCalled();
    expect(result.current.state).toBeNull();
  });

  it("refreshes when provider connections change", async () => {
    const host = fakeHost(async () => STATE);
    const { rerender } = renderHook(
      ({ statuses }) => useAgentSession(host, "/work", statuses),
      { initialProps: { statuses: STATUSES } },
    );
    await waitFor(() => expect(types(host)).toContain("session_state"));
    vi.mocked(host.request).mockClear();
    rerender({ statuses: [{ id: "anthropic", connected: false }] });
    await waitFor(() => expect(types(host)).toEqual(["session_state"]));
  });

  it("waits for provider statuses before refreshing", async () => {
    const host = fakeHost(async () => STATE);
    const { result } = renderHook(() => useAgentSession(host, "/work", null));
    await waitFor(() => expect(result.current.state).toEqual(STATE));
    expect(types(host)).toEqual(["open_session"]);
  });

  it("reopens for a new folder and ignores the old folder's answer", async () => {
    let finishOld: (s: SessionState) => void = () => {};
    const other = { ...STATE, model: mini };
    const host = fakeHost((req) =>
      "cwd" in req && req.cwd === "/old"
        ? new Promise((r) => (finishOld = r))
        : Promise.resolve(other),
    );
    const { result, rerender } = renderHook(
      ({ folder }) => useAgentSession(host, folder, null),
      { initialProps: { folder: "/old" } },
    );
    rerender({ folder: "/new" });
    await waitFor(() => expect(result.current.state).toEqual(other));
    await act(async () => finishOld(STATE));
    expect(result.current.state).toEqual(other);
  });

  it("changes the model and effort, showing pi's answer", async () => {
    const changed = { ...STATE, model: mini, thinkingLevel: "off" as const };
    const host = fakeHost(async (req) =>
      req.type === "open_session" ? STATE : changed,
    );
    const { result } = renderHook(() => useAgentSession(host, "/work", null));
    await waitFor(() => expect(result.current.state).toEqual(STATE));

    await act(() => result.current.setModel(mini));
    expect(host.request).toHaveBeenCalledWith({
      type: "set_model",
      provider: "openai",
      modelId: "mini",
    });
    expect(result.current.state).toEqual(changed);

    await act(() => result.current.setThinkingLevel("high"));
    expect(host.request).toHaveBeenCalledWith({
      type: "set_thinking_level",
      level: "high",
    });
  });

  it("ignores changes before the session is open", async () => {
    const host = fakeHost(() => new Promise(() => {}));
    const { result } = renderHook(() => useAgentSession(host, "/work", null));
    await act(() => result.current.setThinkingLevel("high"));
    expect(types(host)).toEqual(["open_session"]);
  });

  it("shows errors from opening, refreshing and changing", async () => {
    const failing = fakeHost(async () => {
      throw new Error("pi broke");
    });
    const { result: opening } = renderHook(() =>
      useAgentSession(failing, "/work", null),
    );
    await waitFor(() => expect(opening.current.error).toBe("pi broke"));

    const host = fakeHost(async (req) => {
      if (req.type === "open_session") return STATE;
      throw new Error(`${req.type} failed`);
    });
    const { result } = renderHook(() =>
      useAgentSession(host, "/work", STATUSES),
    );
    await waitFor(() =>
      expect(result.current.error).toBe("session_state failed"),
    );
    await act(() => result.current.setModel(mini));
    expect(result.current.error).toBe("set_model failed");
  });

  describe("conversation", () => {
    const hello = { role: "user", content: "Hi", timestamp: 1 } as const;

    async function opened(data: object = STATE) {
      const host = fakeHost(async () => data);
      const hook = renderHook(() => useAgentSession(host, "/work", null));
      await waitFor(() =>
        expect(hook.result.current.transcript).not.toBeNull(),
      );
      return { host, ...hook };
    }

    it("shows a folder switched back to at once, then catches up", async () => {
      let answer: (data: object) => void = () => {};
      const host = fakeHost(async (req) =>
        req.type === "open_session"
          ? new Promise((resolve) => (answer = resolve))
          : undefined,
      );
      const { result, rerender } = renderHook(
        ({ folder }) => useAgentSession(host, folder, null),
        { initialProps: { folder: "/work" } },
      );
      act(() => answer({ ...STATE, messages: [hello] }));
      await waitFor(() => expect(result.current.transcript).not.toBeNull());
      rerender({ folder: "/other" });
      expect(result.current.transcript).toBeNull();
      rerender({ folder: "/work" });
      expect(result.current.transcript?.items).toHaveLength(1);
      // Events before the sidecar answers may still belong to the last folder.
      host.emit({ type: "session_event", event: { type: "agent_start" } });
      expect(result.current.transcript?.running).toBe(false);
      act(() => answer({ ...STATE, messages: [hello, hello] }));
      await waitFor(() =>
        expect(result.current.transcript?.items).toHaveLength(2),
      );
    });

    it("starts from a continued session's history", async () => {
      const { result } = await opened({
        ...STATE,
        messages: [hello],
        running: true,
      });
      expect(result.current.transcript).toMatchObject({
        items: [{ kind: "message", message: hello }],
        running: true,
      });
    });

    it("warns when the saved model wasn't available", async () => {
      const { result } = await opened({
        ...STATE,
        modelWarning: "opus isn't available; using Mini.",
      });
      expect(result.current.transcript?.items).toEqual([
        {
          kind: "notice",
          text: "opus isn't available; using Mini.",
          error: true,
        },
      ]);
    });

    it("shows tool calls still waiting from while the folder was hidden", async () => {
      const { result } = await opened({
        ...STATE,
        approvals: [{ toolCallId: "t1", reason: "Deletes files" }],
      });
      expect(result.current.transcript?.tools.t1).toMatchObject({
        approval: { reason: "Deletes files" },
      });
    });

    it("follows the session's events and errors", async () => {
      const { host, result } = await opened();
      host.emit({ type: "session_event", event: { type: "agent_start" } });
      expect(result.current.transcript?.running).toBe(true);
      host.emit({
        type: "session_event",
        event: { type: "message_start", message: hello },
      });
      host.emit({ type: "session_error", error: "No model." });
      host.emit({ type: "ready" });
      expect(result.current.transcript).toEqual({
        items: [
          { kind: "message", message: hello },
          { kind: "notice", text: "No model.", error: true },
        ],
        tools: {},
        running: false,
      });
    });

    it("stops listening when the folder closes", async () => {
      const { host, unmount } = await opened();
      unmount();
      expect(host.listeners.size).toBe(0);
    });

    it("sends a message", async () => {
      const { host, result } = await opened();
      await act(() => result.current.send("Fix the tests"));
      expect(host.request).toHaveBeenCalledWith({
        type: "prompt",
        text: "Fix the tests",
      });
    });

    it("sends images, with or without text", async () => {
      const { host, result } = await opened();
      const images = [
        { type: "image" as const, data: "AA==", mimeType: "image/png" },
      ];
      await act(() => result.current.send("", images));
      expect(host.request).toHaveBeenCalledWith({
        type: "prompt",
        text: "",
        images,
      });
    });

    it("doesn't send blank messages or before the session opens", async () => {
      const { host, result } = await opened();
      await act(() => result.current.send("  \n "));
      const waiting = fakeHost(() => new Promise(() => {}));
      const { result: early } = renderHook(() =>
        useAgentSession(waiting, "/work", null),
      );
      await act(() => early.current.send("Hi"));
      await act(() => early.current.stop());
      expect(types(host)).toEqual(["open_session"]);
      expect(types(waiting)).toEqual(["open_session"]);
    });

    it("shows a message pi refused to take", async () => {
      const host = fakeHost(async (req) => {
        if (req.type === "open_session") return STATE;
        throw new Error("No folder is open.");
      });
      const { result } = renderHook(() => useAgentSession(host, "/work", null));
      await waitFor(() => expect(result.current.transcript).not.toBeNull());
      await act(() => result.current.send("Hi"));
      expect(result.current.error).toBe("No folder is open.");
      await act(() => result.current.stop());
      expect(types(host)).toContain("abort");
    });

    it("clears the conversation, and says why if it can't", async () => {
      const hello = { role: "user", content: "hello", timestamp: 1 };
      let fail = false;
      const host = fakeHost(async (req) => {
        if (req.type === "open_session") return { ...STATE, messages: [hello] };
        if (fail) throw new Error("Disk full");
        return {
          ...STATE,
          messages: [],
          running: false,
          approvals: [],
          trust: "ask",
        };
      });
      const { result } = renderHook(() => useAgentSession(host, "/work", null));
      await waitFor(() => expect(result.current.transcript).not.toBeNull());
      expect(result.current.transcript).not.toEqual(fromHistory([], false));
      await act(() => result.current.clear());
      expect(host.request).toHaveBeenLastCalledWith({ type: "clear_session" });
      expect(result.current.transcript).toEqual(fromHistory([], false));
      fail = true;
      await act(() => result.current.clear());
      expect(result.current.error).toBe("Disk full");
    });

    it("stops the run", async () => {
      const { host, result } = await opened();
      await act(() => result.current.stop());
      expect(host.request).toHaveBeenCalledWith({ type: "abort" });
    });
  });
});
