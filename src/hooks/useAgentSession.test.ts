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
      if (data === null) return null;
      return req.type === "open_session" || req.type === "new_session"
        ? {
            session: "s1",
            messages: [],
            running: false,
            approvals: [],
            ...(data as object),
          }
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
      session: "s1",
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

  it("sends the answers to an ask_user call's questions", async () => {
    const host = fakeHost(async () => STATE);
    const { result } = renderHook(() => useAgentSession(host, "/work", null));
    await waitFor(() => expect(result.current.state).toEqual(STATE));
    host.emit({
      type: "approval_request",
      session: "s1",
      request: { toolCallId: "q1" },
    });
    const answers = [{ question: "Where?", choices: [{ answer: "SQLite" }] }];
    act(() => result.current.answer("q1", true, answers));
    expect(result.current.transcript?.tools.q1.approval).toBeUndefined();
    expect(host.send).toHaveBeenCalledWith({
      type: "approval_answer",
      toolCallId: "q1",
      approved: true,
      answers,
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
      session: "s1",
    });
    expect(result.current.state).toEqual(changed);

    await act(() => result.current.setThinkingLevel("high"));
    expect(host.request).toHaveBeenCalledWith({
      type: "set_thinking_level",
      level: "high",
      session: "s1",
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
      host.emit({
        type: "session_event",
        session: "s1",
        event: { type: "agent_start" },
      });
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
      host.emit({
        type: "session_event",
        session: "s1",
        event: { type: "agent_start" },
      });
      expect(result.current.transcript?.running).toBe(true);
      host.emit({
        type: "session_event",
        session: "s1",
        event: { type: "message_start", message: hello },
      });
      host.emit({ type: "session_error", session: "s1", error: "No model." });
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
        session: "s1",
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
        session: "s1",
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

    it("stops the run", async () => {
      const { host, result } = await opened();
      await act(() => result.current.stop());
      expect(host.request).toHaveBeenCalledWith({
        type: "abort",
        session: "s1",
      });
    });
  });
});

describe("several conversations in a folder", () => {
  const hello = { role: "user", content: "hello", timestamp: 1 };
  /** A folder whose open_session shows `session` (its saved one, "s1", by default). */
  const folder = (fail = false) => {
    const host = fakeHost(async (req) => {
      const r = req as { type: string; session?: string };
      if (fail && r.type !== "open_session") throw new Error("Disk full");
      if (r.type === "new_session") return { ...STATE, session: "s2" };
      if (r.type === "list_sessions") {
        return [
          {
            id: "s1",
            title: "hello",
            modified: 2,
            messageCount: 2,
            open: true,
          },
          {
            id: "s0",
            title: "older",
            modified: 1,
            messageCount: 4,
            open: false,
          },
        ];
      }
      if (r.type === "close_session") return undefined;
      return { ...STATE, session: r.session ?? "s1", messages: [hello] };
    });
    const hook = renderHook(() => useAgentSession(host, "/work", null));
    return { host, ...hook };
  };

  it("shows a new conversation that starts with its first message, and switches back", async () => {
    const { host, result } = folder();
    await waitFor(() => expect(result.current.session).toBe("s1"));
    act(() => result.current.create());
    expect(result.current.none).toBe(true);
    expect(types(host)).not.toContain("new_session");
    await act(() => result.current.send("Another thing"));
    expect(types(host).slice(-2)).toEqual(["new_session", "prompt"]);
    expect(result.current.session).toBe("s2");
    expect(result.current.transcript).toEqual(fromHistory([], false));
    await act(() => result.current.show("s1"));
    expect(host.request).toHaveBeenLastCalledWith({
      type: "open_session",
      cwd: "/work",
      session: "s1",
    });
    expect(result.current.transcript?.items).toHaveLength(1);
  });

  it("applies only the shown conversation's events", async () => {
    const { host, result } = folder();
    await waitFor(() => expect(result.current.session).toBe("s1"));
    host.emit({ type: "session_error", session: "s2", error: "Elsewhere" });
    expect(result.current.transcript?.items).toHaveLength(1);
    host.emit({ type: "session_error", session: "s1", error: "Here" });
    expect(result.current.transcript?.items).toHaveLength(2);
  });

  it("shows a neighbour when the shown conversation closes, and none after the last", async () => {
    const { host, result } = folder();
    await waitFor(() => expect(result.current.session).toBe("s1"));
    await act(() => result.current.close("s1", ["s0", "s1", "s3"]));
    expect(host.request).toHaveBeenCalledWith({
      type: "close_session",
      cwd: "/work",
      session: "s1",
    });
    expect(host.request).toHaveBeenLastCalledWith({
      type: "open_session",
      cwd: "/work",
      session: "s3",
    });
    await act(() => result.current.close("s3", ["s3"]));
    expect(host.request).toHaveBeenCalledWith({
      type: "close_session",
      cwd: "/work",
      session: "s3",
    });
    expect(result.current.none).toBe(true);
    expect(result.current.session).toBeNull();
  });

  it("closes a conversation in the background without switching", async () => {
    const { host, result } = folder();
    await waitFor(() => expect(result.current.session).toBe("s1"));
    await act(() => result.current.close("s9", ["s1", "s9"]));
    expect(host.request).toHaveBeenLastCalledWith({
      type: "close_session",
      cwd: "/work",
      session: "s9",
    });
    expect(result.current.session).toBe("s1");
  });

  it("shows a folder with no conversation as a new one, with what it would start with", async () => {
    let first = true;
    const host = fakeHost(async (req) => {
      if (req.type === "draft_state") return { ...STATE, model: mini };
      if (req.type !== "open_session") return undefined;
      const answer = first ? { ...STATE, session: "s1" } : null;
      first = false;
      return answer;
    });
    const { result, rerender } = renderHook(
      ({ folder }) => useAgentSession(host, folder, null),
      { initialProps: { folder: "/work" } },
    );
    await waitFor(() => expect(result.current.session).toBe("s1"));
    rerender({ folder: "/fresh" });
    await waitFor(() => expect(result.current.state?.model).toEqual(mini));
    expect(result.current.none).toBe(true);
    expect(result.current.transcript).toBeNull();
  });

  it("starts the conversation with the first message, taking choices made before it", async () => {
    const host = fakeHost(async (req) => {
      if (req.type === "open_session") return null;
      if (req.type === "new_session") return { ...STATE, session: "s2" };
      if (req.type === "set_model") return { ...STATE, model: mini };
      return undefined;
    });
    const { result } = renderHook(() => useAgentSession(host, "/work", null));
    await waitFor(() => expect(result.current.none).toBe(true));
    await act(() => result.current.setModel(mini));
    await waitFor(() =>
      expect(host.request).toHaveBeenCalledWith({
        type: "draft_state",
        model: { provider: "openai", id: "mini" },
      }),
    );
    const sent = () => types(host).filter((t) => t !== "draft_state");
    expect(sent()).toEqual(["open_session"]);
    await act(() => result.current.send("Build it"));
    expect(sent()).toEqual([
      "open_session",
      "new_session",
      "set_model",
      "prompt",
    ]);
    // By name, so a conversation shown meanwhile can't take them.
    expect(host.request).toHaveBeenCalledWith(
      expect.objectContaining({ type: "set_model", session: "s2" }),
    );
    expect(host.request).toHaveBeenCalledWith(
      expect.objectContaining({ type: "prompt", session: "s2" }),
    );
    expect(result.current.session).toBe("s2");
    expect(result.current.state?.model).toEqual(mini);
  });

  it("applies the new conversation's first events at once", async () => {
    const host = fakeHost(async (req) => {
      if (req.type === "open_session") return null;
      if (req.type === "new_session") return { ...STATE, session: "s2" };
      if (req.type === "prompt") {
        host.emit({
          type: "session_error",
          session: "s2",
          error: "First event",
        });
      }
      return undefined;
    });
    const { result } = renderHook(() => useAgentSession(host, "/work", null));
    await waitFor(() => expect(result.current.none).toBe(true));
    await act(() => result.current.send("Build it"));
    expect(result.current.transcript?.items).toHaveLength(1);
  });

  it("says why a conversation couldn't be started", async () => {
    const { result } = folder(true);
    await waitFor(() => expect(result.current.session).toBe("s1"));
    act(() => result.current.create());
    await act(() => result.current.send("Build it"));
    expect(result.current.error).toBe("Disk full");
  });

  it("shows a new conversation in another folder once it's selected", async () => {
    const host = fakeHost(async (req) =>
      req.type === "open_session" ? { ...STATE, session: "s1" } : undefined,
    );
    const { result, rerender } = renderHook(
      ({ folder }) => useAgentSession(host, folder, null),
      { initialProps: { folder: "/work" } },
    );
    await waitFor(() => expect(result.current.session).toBe("s1"));
    act(() => result.current.create("/other"));
    rerender({ folder: "/other" });
    await waitFor(() => expect(result.current.none).toBe(true));
    expect(types(host).filter((t) => t !== "draft_state")).toEqual([
      "open_session",
    ]);
  });
});

describe("reopening a conversation", () => {
  const said = (text: string) => [
    { role: "user", content: text, timestamp: 1 },
  ];
  /** A folder whose open_session waits for `start`, per session. */
  const slow = () => {
    const starts = new Map<string, () => void>();
    const host = fakeHost(async (req) => {
      const r = req as { type: string; session?: string };
      if (r.type === "read_session") return said(`saved ${r.session}`);
      if (r.type !== "open_session") return undefined;
      if (!r.session) return { ...STATE, session: "s1" };
      await new Promise<void>((go) => starts.set(r.session!, go));
      return {
        ...STATE,
        session: r.session,
        messages: said(`live ${r.session}`),
      };
    });
    return { host, start: (id: string) => starts.get(id)!() };
  };
  const text = (t: ReturnType<typeof useAgentSession>["transcript"]) =>
    JSON.stringify(t?.items);

  it("shows the saved transcript while the session starts, then the live one", async () => {
    const { host, start } = slow();
    const { result } = renderHook(() => useAgentSession(host, "/work", null));
    await waitFor(() => expect(result.current.session).toBe("s1"));
    act(() => void result.current.show("s2"));
    await waitFor(() =>
      expect(text(result.current.transcript)).toContain("saved s2"),
    );
    expect(result.current.state).toBeNull();
    await act(async () => start("s2"));
    await waitFor(() =>
      expect(text(result.current.transcript)).toContain("live s2"),
    );
    expect(result.current.state).toEqual(STATE);
  });

  it("shows only the last conversation picked, whichever starts first", async () => {
    const { host, start } = slow();
    const { result } = renderHook(() => useAgentSession(host, "/work", null));
    await waitFor(() => expect(result.current.session).toBe("s1"));
    act(() => void result.current.show("a"));
    act(() => void result.current.show("b"));
    await waitFor(() =>
      expect(text(result.current.transcript)).toContain("saved b"),
    );
    await act(async () => start("a"));
    expect(result.current.session).toBe("b");
    await act(async () => start("b"));
    await waitFor(() =>
      expect(text(result.current.transcript)).toContain("live b"),
    );
  });

  it("shows a conversation picked in another folder once that folder is selected", async () => {
    const { host, start } = slow();
    const { result, rerender } = renderHook(
      ({ folder }) => useAgentSession(host, folder, null),
      { initialProps: { folder: "/work" } },
    );
    await waitFor(() => expect(result.current.session).toBe("s1"));
    act(() => void result.current.show("s9", "/other"));
    rerender({ folder: "/other" });
    await waitFor(() =>
      expect(text(result.current.transcript)).toContain("saved s9"),
    );
    await act(async () => start("s9"));
    await waitFor(() => expect(result.current.session).toBe("s9"));
    expect(host.request).not.toHaveBeenCalledWith({
      type: "open_session",
      cwd: "/other",
    });
  });
});
