// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type {
  HostMessage,
  HostRequest,
  ModelInfo,
  ProviderStatus,
  ThinkingLevel,
} from "../shared/hostProtocol.ts";
import type { AgentMessage, SessionEvent } from "../shared/agentTypes.ts";
import {
  createHost,
  describeError,
  toWireEvent,
  type Runtime,
  type Session,
} from "./host.ts";
import type { ClaudeCode, ClaudeCodeStatus } from "./claudeCode.ts";

type Interaction = Parameters<Runtime["login"]>[2];

/**
 * A fake ModelRuntime. `connected` is the stored credential per provider;
 * `onLogin` plays the part of a provider's login flow.
 */
function fakeRuntime(
  onLogin: (
    interaction: Interaction,
    method: string,
  ) => Promise<unknown> = async () => {},
) {
  const connected = new Map<string, "oauth" | "api_key">();
  const runtime: Runtime = {
    checkAuth: async (id) => {
      const type = connected.get(id);
      return type ? { type } : undefined;
    },
    login: vi.fn(async (id, method, interaction) => {
      await onLogin(interaction, method);
      connected.set(id, method);
    }),
    logout: vi.fn(async (id) => void connected.delete(id)),
    getAvailable: async () => MODELS,
  };
  return { runtime, connected };
}

// Extra fields stand in for the rest of pi's Model, which the app never sees.
const OPUS = { provider: "anthropic", id: "opus", name: "Opus", api: "x" };
const MINI = { provider: "openai", id: "mini", name: "Mini", api: "x" };
const MODELS: ModelInfo[] = [OPUS, MINI];

/** A fake AgentSession: Opus reasons, Mini doesn't, like pi clamps. */
function fakeSession() {
  const levels = (m?: ModelInfo): ThinkingLevel[] =>
    m?.id === "opus" ? ["off", "low", "high"] : ["off"];
  const session = {
    model: OPUS as ModelInfo | undefined,
    thinkingLevel: "low" as ThinkingLevel,
    getAvailableThinkingLevels: () => levels(session.model),
    setModel: vi.fn(async (m: ModelInfo) => {
      session.model = m;
      if (!levels(m).includes(session.thinkingLevel)) {
        session.thinkingLevel = "off";
      }
    }),
    setThinkingLevel: vi.fn((level: ThinkingLevel) => {
      session.thinkingLevel = level;
    }),
    messages: [] as AgentMessage[],
    isStreaming: false,
    listeners: new Set<(e: SessionEvent) => void>(),
    subscribe: vi.fn((cb: (e: SessionEvent) => void) => {
      session.listeners.add(cb);
      return () => void session.listeners.delete(cb);
    }),
    emit: (e: SessionEvent) => session.listeners.forEach((cb) => cb(e)),
    prompt: vi.fn(async () => {}),
    abort: vi.fn(async () => {}),
    dispose: vi.fn(),
  };
  return session satisfies Session;
}

/** A fake Claude Code install; signed out unless told otherwise. */
function fakeClaudeCode(
  status: ClaudeCodeStatus = { installed: true, loggedIn: false },
  login: ClaudeCode["login"] = async () => {},
) {
  return { status: async () => status, login: vi.fn(login) };
}

/** Wires a host to a fake runtime and records everything it sends. */
function setup(
  runtime: Runtime,
  openSession: (cwd: string) => Promise<Session> = async () => fakeSession(),
  claudeCode: ClaudeCode = fakeClaudeCode(),
  usesCodexLogin = async () => false,
) {
  const sent: HostMessage[] = [];
  const host = createHost(runtime, (m) => sent.push(m), openSession, {
    claudeCode,
    usesCodexLogin,
  });
  const responses = () => sent.filter((m) => m.type === "response");
  const request = async (r: HostRequest) => host.handle(r);
  return { host, sent, responses, request };
}

/** Waits until the host has sent a message of `type`. */
async function waitFor(sent: HostMessage[], type: HostMessage["type"]) {
  await vi.waitFor(() => {
    if (!sent.some((m) => m.type === type)) throw new Error(`no ${type} yet`);
  });
  return sent.filter((m) => m.type === type).at(-1)!;
}

describe("status", () => {
  it("reports every provider and how it is connected", async () => {
    const { runtime, connected } = fakeRuntime();
    connected.set("anthropic", "oauth");
    const { request, responses } = setup(runtime);
    await request({ id: 1, type: "status" });
    expect(responses()).toEqual([
      {
        type: "response",
        id: 1,
        ok: true,
        data: [
          { id: "claude-code", connected: false, installed: true },
          { id: "anthropic", connected: true, method: "oauth" },
          { id: "openai-codex", connected: false },
          { id: "openai", connected: false },
        ],
      },
    ]);
  });
});

describe("Claude Code", () => {
  it("reports a signed-in Claude Code as a subscription", async () => {
    const { request, responses } = setup(
      fakeRuntime().runtime,
      undefined,
      fakeClaudeCode({ installed: true, loggedIn: true }),
    );
    await request({ id: 1, type: "status" });
    expect((responses()[0] as { data: unknown[] }).data[0]).toEqual({
      id: "claude-code",
      connected: true,
      method: "oauth",
      installed: true,
    });
  });

  it("signs in through Claude Code, opening its sign-in page", async () => {
    const claude = fakeClaudeCode(undefined, async (_signal, onUrl) =>
      onUrl("https://claude.ai/login"),
    );
    const { runtime } = fakeRuntime();
    const { request, sent } = setup(runtime, undefined, claude);
    await request({
      id: 1,
      type: "login",
      provider: "claude-code",
      method: "oauth",
    });
    expect(claude.login).toHaveBeenCalled();
    expect(runtime.login).not.toHaveBeenCalled();
    expect(sent).toContainEqual({
      type: "auth_event",
      event: { type: "auth_url", url: "https://claude.ai/login" },
    });
  });

  it("won't sign out of Claude Code itself", async () => {
    const { request, responses } = setup(fakeRuntime().runtime);
    await request({ id: 1, type: "logout", provider: "claude-code" });
    expect(responses()[0]).toMatchObject({
      ok: false,
      error: "Sign out of Claude Code in Claude Code.",
    });
  });

  it("offers the bridge's models only while Claude Code is signed in", async () => {
    const bridged = {
      provider: "claude-bridge",
      id: "claude-opus-5-5",
      name: "Claude Opus 5.5",
    };
    const runtime = {
      ...fakeRuntime().runtime,
      getAvailable: async () => [...MODELS, bridged],
    };
    const ids = async (loggedIn: boolean) => {
      const { request, responses } = setup(
        runtime,
        undefined,
        fakeClaudeCode({ installed: true, loggedIn }),
      );
      await request({ id: 1, type: "open_session", cwd: "/work" });
      const data = (responses()[0] as { data: { models: ModelInfo[] } }).data;
      return data.models.map((m) => m.provider);
    };
    expect(await ids(false)).toEqual(["anthropic", "openai"]);
    expect(await ids(true)).toEqual(["anthropic", "openai", "claude-bridge"]);
  });
});

describe("Codex login", () => {
  it("marks ChatGPT signed in through the Codex CLI", async () => {
    const { runtime, connected } = fakeRuntime();
    connected.set("openai-codex", "oauth");
    const status = async (usesCodex: boolean) => {
      const { request, responses } = setup(
        runtime,
        undefined,
        undefined,
        async () => usesCodex,
      );
      await request({ id: 1, type: "status" });
      return (responses()[0] as { data: ProviderStatus[] }).data[2];
    };
    expect(await status(true)).toEqual({
      id: "openai-codex",
      connected: true,
      method: "oauth",
      viaCodex: true,
    });
    expect(await status(false)).toEqual({
      id: "openai-codex",
      connected: true,
      method: "oauth",
    });
  });
});

describe("login", () => {
  it("signs in and returns the new status", async () => {
    const { runtime } = fakeRuntime();
    const { request, responses } = setup(runtime);
    await request({
      id: 1,
      type: "login",
      provider: "openai-codex",
      method: "oauth",
    });
    expect(responses()[0]).toMatchObject({
      ok: true,
      data: { id: "openai-codex", connected: true, method: "oauth" },
    });
  });

  it("forwards events such as the sign-in URL", async () => {
    const { runtime } = fakeRuntime(async (i) =>
      i.notify({ type: "auth_url", url: "https://claude.ai/oauth" }),
    );
    const { request, sent } = setup(runtime);
    await request({
      id: 1,
      type: "login",
      provider: "anthropic",
      method: "oauth",
    });
    expect(sent[0]).toEqual({
      type: "auth_event",
      event: { type: "auth_url", url: "https://claude.ai/oauth" },
    });
  });

  it("forwards prompts and resumes with the app's answer", async () => {
    let answer = "";
    const { runtime } = fakeRuntime(async (i) => {
      answer = await i.prompt({
        type: "manual_code",
        message: "Paste the code",
      });
    });
    const { request, sent } = setup(runtime);
    const done = request({
      id: 1,
      type: "login",
      provider: "anthropic",
      method: "oauth",
    });

    const prompt = await waitFor(sent, "auth_prompt");
    expect(prompt).toEqual({
      type: "auth_prompt",
      promptId: 1,
      prompt: { type: "manual_code", message: "Paste the code" },
    });
    await request({ type: "prompt_answer", promptId: 1, value: "code#state" });
    await done;
    expect(answer).toBe("code#state");
  });

  it("strips the per-prompt signal before sending a prompt", async () => {
    const { runtime } = fakeRuntime(async (i) => {
      await i.prompt({
        type: "manual_code",
        message: "Paste",
        signal: new AbortController().signal,
      });
    });
    const { request, sent } = setup(runtime);
    const done = request({
      id: 1,
      type: "login",
      provider: "anthropic",
      method: "oauth",
    });
    const prompt = await waitFor(sent, "auth_prompt");
    expect(JSON.stringify(prompt)).not.toContain("signal");
    await request({ type: "prompt_answer", promptId: 1, value: "code" });
    await done;
  });

  it("always picks the browser when Codex offers browser or device code", async () => {
    let choice = "";
    const { runtime } = fakeRuntime(async (i) => {
      choice = await i.prompt({
        type: "select",
        message: "Select OpenAI Codex login method:",
        options: [
          { id: "browser", label: "Browser login (default)" },
          { id: "device_code", label: "Device code login (headless)" },
        ],
      });
    });
    const { request, sent } = setup(runtime);
    await request({
      id: 1,
      type: "login",
      provider: "openai-codex",
      method: "oauth",
    });
    expect(choice).toBe("browser");
    expect(sent.some((m) => m.type === "auth_prompt")).toBe(false);
  });

  it("forwards a choice that has no browser option", async () => {
    const { runtime } = fakeRuntime(async (i) => {
      await i.prompt({
        type: "select",
        message: "Which org?",
        options: [{ id: "a", label: "A" }],
      });
    });
    const { request, sent } = setup(runtime);
    const done = request({
      id: 1,
      type: "login",
      provider: "openai-codex",
      method: "oauth",
    });
    const prompt = await waitFor(sent, "auth_prompt");
    expect(prompt).toMatchObject({ prompt: { type: "select" } });
    await request({ type: "prompt_answer", promptId: 1, value: "a" });
    await done;
  });

  it("fails the sign-in when the app cancels a prompt", async () => {
    const { runtime } = fakeRuntime(async (i) => {
      await i.prompt({ type: "text", message: "?" });
    });
    const { request, sent, responses } = setup(runtime);
    const done = request({
      id: 1,
      type: "login",
      provider: "anthropic",
      method: "oauth",
    });
    await waitFor(sent, "auth_prompt");
    await request({ type: "prompt_cancel", promptId: 1 });
    await done;
    expect(responses()[0]).toMatchObject({ ok: false, error: "Cancelled" });
  });

  it("tells the app when pi closes a prompt it no longer needs", async () => {
    const promptDone = new AbortController();
    const { runtime } = fakeRuntime(async (i) => {
      // Like the browser callback beating the paste field.
      const paste = i
        .prompt({
          type: "manual_code",
          message: "Paste",
          signal: promptDone.signal,
        })
        .catch(() => "");
      promptDone.abort();
      await paste;
    });
    const { request, sent, responses } = setup(runtime);
    await request({
      id: 1,
      type: "login",
      provider: "anthropic",
      method: "oauth",
    });
    expect(sent).toContainEqual({ type: "auth_prompt_closed", promptId: 1 });
    expect(responses()[0]).toMatchObject({ ok: true });
  });

  it("cancels an in-progress sign-in", async () => {
    const { runtime } = fakeRuntime(async (i) => {
      await i.prompt({ type: "manual_code", message: "Paste" });
    });
    const { request, sent, responses } = setup(runtime);
    const done = request({
      id: 1,
      type: "login",
      provider: "anthropic",
      method: "oauth",
    });
    await waitFor(sent, "auth_prompt");

    await request({ id: 2, type: "cancel_login" });
    await done;
    expect(sent).toContainEqual({ type: "auth_prompt_closed", promptId: 1 });
    expect(responses()).toContainEqual({ type: "response", id: 2, ok: true });
    expect(responses()).toContainEqual({
      type: "response",
      id: 1,
      ok: false,
      error: "Sign-in cancelled.",
    });
  });

  it("allows only one sign-in at a time", async () => {
    const { runtime } = fakeRuntime(async (i) => {
      await i.prompt({ type: "manual_code", message: "Paste" });
    });
    const { request, sent, responses } = setup(runtime);
    const first = request({
      id: 1,
      type: "login",
      provider: "anthropic",
      method: "oauth",
    });
    await waitFor(sent, "auth_prompt");
    await request({
      id: 2,
      type: "login",
      provider: "openai",
      method: "api_key",
      apiKey: "sk-x",
    });
    expect(responses()).toContainEqual({
      type: "response",
      id: 2,
      ok: false,
      error: "Another sign-in is already in progress.",
    });
    await request({ type: "prompt_answer", promptId: 1, value: "x" });
    await first;
  });

  it("answers pi's key prompt with the key sent in the request, trimmed", async () => {
    let key = "";
    const { runtime } = fakeRuntime(async (i) => {
      key = await i.prompt({ type: "secret", message: "API key" });
    });
    const { request, sent } = setup(runtime);
    await request({
      id: 1,
      type: "login",
      provider: "openai",
      method: "api_key",
      apiKey: "  sk-abc  ",
    });
    expect(key).toBe("sk-abc");
    expect(sent.some((m) => m.type === "auth_prompt")).toBe(false);
  });

  it("rejects keys pi would interpret instead of store", async () => {
    const { runtime } = fakeRuntime();
    const { request, responses } = setup(runtime);
    await request({
      id: 1,
      type: "login",
      provider: "anthropic",
      method: "api_key",
      apiKey: "!cat ~/.ssh/id_rsa",
    });
    expect(responses()[0]).toMatchObject({ ok: false });
    expect(runtime.login).not.toHaveBeenCalled();
  });

  it("reports provider errors and frees the slot for another try", async () => {
    let fail = true;
    const { runtime } = fakeRuntime(async () => {
      if (fail) throw new Error("Token exchange failed");
    });
    const { request, responses } = setup(runtime);
    await request({
      id: 1,
      type: "login",
      provider: "anthropic",
      method: "oauth",
    });
    fail = false;
    await request({
      id: 2,
      type: "login",
      provider: "anthropic",
      method: "oauth",
    });
    expect(responses()).toEqual([
      { type: "response", id: 1, ok: false, error: "Token exchange failed" },
      expect.objectContaining({ id: 2, ok: true }),
    ]);
  });
});

describe("login edge cases", () => {
  it("asks for a key when an api_key sign-in comes without one", async () => {
    const { runtime } = fakeRuntime();
    const { request, responses } = setup(runtime);
    await request({
      id: 1,
      type: "login",
      provider: "openai",
      method: "api_key",
    });
    expect(responses()[0]).toMatchObject({
      ok: false,
      error: "Enter an API key.",
    });
  });

  it("doesn't report a prompt as closed once it was answered", async () => {
    const promptDone = new AbortController();
    const { runtime } = fakeRuntime(async (i) => {
      await i.prompt({
        type: "manual_code",
        message: "Paste",
        signal: promptDone.signal,
      });
      promptDone.abort(); // pi tidies up after the answer arrived
    });
    const { request, sent } = setup(runtime);
    const done = request({
      id: 1,
      type: "login",
      provider: "anthropic",
      method: "oauth",
    });
    await waitFor(sent, "auth_prompt");
    await request({ type: "prompt_answer", promptId: 1, value: "code" });
    await done;
    expect(sent.some((m) => m.type === "auth_prompt_closed")).toBe(false);
  });
});

describe("logout", () => {
  it("removes the credential and returns the new status", async () => {
    const { runtime, connected } = fakeRuntime();
    connected.set("openai", "api_key");
    const { request, responses } = setup(runtime);
    await request({ id: 1, type: "logout", provider: "openai" });
    expect(responses()[0]).toMatchObject({
      ok: true,
      data: { id: "openai", connected: false },
    });
  });
});

describe("prompt answers with no pending prompt", () => {
  it("are ignored", async () => {
    const { runtime } = fakeRuntime();
    const { request, sent } = setup(runtime);
    await request({ type: "prompt_answer", promptId: 99, value: "x" });
    await request({ type: "prompt_cancel", promptId: 99 });
    expect(sent).toEqual([]);
  });
});

describe("describeError", () => {
  it("explains a busy sign-in port", () => {
    const error = Object.assign(new Error("listen EADDRINUSE"), {
      code: "EADDRINUSE",
    });
    expect(describeError(error)).toMatch(/sign-in port/);
  });

  it("uses the message of other errors", () => {
    expect(describeError(new Error("boom"))).toBe("boom");
  });

  it("stringifies non-errors", () => {
    expect(describeError("plain")).toBe("plain");
  });
});

describe("sessions", () => {
  const opus = { provider: "anthropic", id: "opus", name: "Opus" };
  const mini = { provider: "openai", id: "mini", name: "Mini" };

  it("opens a session for a folder and reports pi's choices", async () => {
    const openSession = vi.fn(async () => fakeSession());
    const { request, responses } = setup(fakeRuntime().runtime, openSession);
    await request({ id: 1, type: "open_session", cwd: "/work" });
    expect(openSession).toHaveBeenCalledWith("/work");
    expect(responses()[0]).toEqual({
      type: "response",
      id: 1,
      ok: true,
      data: {
        models: [opus, mini],
        model: opus,
        thinkingLevel: "low",
        thinkingLevels: ["off", "low", "high"],
        messages: [],
        running: false,
      },
    });
  });

  it("returns the conversation of a continued session", async () => {
    const session = fakeSession();
    const hello = { role: "user", content: "hi", timestamp: 1 } as const;
    session.messages = [hello];
    session.isStreaming = true;
    const { request, responses } = setup(
      fakeRuntime().runtime,
      async () => session,
    );
    await request({ id: 1, type: "open_session", cwd: "/work" });
    expect(responses()[0]).toMatchObject({
      data: { messages: [hello], running: true },
    });
  });

  it("reports a session with no model yet", async () => {
    const { request, responses } = setup(fakeRuntime().runtime, async () => ({
      ...fakeSession(),
      model: undefined,
    }));
    await request({ id: 1, type: "open_session", cwd: "/work" });
    const data = (responses()[0] as { data: { model?: unknown } }).data;
    expect(data.model).toBeUndefined();
  });

  it("disposes the previous session when another folder opens", async () => {
    const first = fakeSession();
    const sessions = [first, fakeSession()];
    const { request } = setup(fakeRuntime().runtime, async () =>
      sessions.shift()!,
    );
    await request({ id: 1, type: "open_session", cwd: "/a" });
    await request({ id: 2, type: "open_session", cwd: "/b" });
    expect(first.dispose).toHaveBeenCalled();
  });

  it("switches model through pi, keeping it for the next session", async () => {
    const session = fakeSession();
    const { request, responses } = setup(
      fakeRuntime().runtime,
      async () => session,
    );
    await request({ id: 1, type: "open_session", cwd: "/work" });
    await request({
      id: 2,
      type: "set_model",
      provider: "openai",
      modelId: "mini",
    });
    expect(session.setModel).toHaveBeenCalledWith(MINI, { persist: true });
    expect(responses()[1]).toMatchObject({
      ok: true,
      data: { model: mini, thinkingLevel: "off", thinkingLevels: ["off"] },
    });
  });

  it("refuses a model that isn't available", async () => {
    const { request, responses } = setup(fakeRuntime().runtime);
    await request({ id: 1, type: "open_session", cwd: "/work" });
    await request({
      id: 2,
      type: "set_model",
      provider: "openai",
      modelId: "gone",
    });
    expect(responses()[1]).toMatchObject({
      ok: false,
      error: "gone isn't available.",
    });
  });

  it("sets the effort through pi, keeping it for the next session", async () => {
    const session = fakeSession();
    const { request, responses } = setup(
      fakeRuntime().runtime,
      async () => session,
    );
    await request({ id: 1, type: "open_session", cwd: "/work" });
    await request({ id: 2, type: "set_thinking_level", level: "high" });
    expect(session.setThinkingLevel).toHaveBeenCalledWith("high", {
      persist: true,
    });
    expect(responses()[1]).toMatchObject({
      ok: true,
      data: { thinkingLevel: "high" },
    });
  });

  it("refreshes the state", async () => {
    const { request, responses } = setup(fakeRuntime().runtime);
    await request({ id: 1, type: "open_session", cwd: "/work" });
    await request({ id: 2, type: "session_state" });
    expect(responses()[1]).toMatchObject({ ok: true, data: { model: opus } });
  });

  it("forwards the session's events in pi's wire form", async () => {
    const session = fakeSession();
    const { request, sent } = setup(fakeRuntime().runtime, async () => session);
    await request({ id: 1, type: "open_session", cwd: "/work" });
    session.emit({ type: "agent_start" });
    session.emit({
      type: "message_update",
      message: { role: "assistant" },
      assistantMessageEvent: {
        type: "text_delta",
        contentIndex: 0,
        delta: "Hi",
        partial: { role: "assistant" },
      },
    } as SessionEvent);
    expect(sent.filter((m) => m.type === "session_event")).toEqual([
      { type: "session_event", event: { type: "agent_start" } },
      {
        type: "session_event",
        event: {
          type: "message_update",
          assistantMessageEvent: {
            type: "text_delta",
            contentIndex: 0,
            delta: "Hi",
          },
        },
      },
    ]);
  });

  it("stops forwarding the previous session's events", async () => {
    const first = fakeSession();
    const sessions = [first, fakeSession()];
    const { request, sent } = setup(fakeRuntime().runtime, async () =>
      sessions.shift()!,
    );
    await request({ id: 1, type: "open_session", cwd: "/a" });
    await request({ id: 2, type: "open_session", cwd: "/b" });
    first.emit({ type: "agent_start" });
    expect(sent.some((m) => m.type === "session_event")).toBe(false);
  });

  it("sends a prompt without waiting for the run", async () => {
    const session = fakeSession();
    session.prompt.mockReturnValue(new Promise(() => {}));
    const { request, responses } = setup(
      fakeRuntime().runtime,
      async () => session,
    );
    await request({ id: 1, type: "open_session", cwd: "/work" });
    await request({ id: 2, type: "prompt", text: "Fix it" });
    expect(session.prompt).toHaveBeenCalledWith("Fix it", {});
    expect(responses()[1]).toEqual({ type: "response", id: 2, ok: true });
  });

  it("steers the run with a prompt sent while it works", async () => {
    const session = fakeSession();
    session.isStreaming = true;
    const { request } = setup(fakeRuntime().runtime, async () => session);
    await request({ id: 1, type: "open_session", cwd: "/work" });
    await request({ id: 2, type: "prompt", text: "Stop that" });
    expect(session.prompt).toHaveBeenCalledWith("Stop that", {
      streamingBehavior: "steer",
    });
  });

  it("reports a run pi couldn't carry out", async () => {
    const session = fakeSession();
    session.prompt.mockRejectedValue(new Error("No model selected."));
    const { request, sent } = setup(fakeRuntime().runtime, async () => session);
    await request({ id: 1, type: "open_session", cwd: "/work" });
    await request({ id: 2, type: "prompt", text: "Hi" });
    expect(await waitFor(sent, "session_error")).toEqual({
      type: "session_error",
      error: "No model selected.",
    });
  });

  it("aborts the run", async () => {
    const session = fakeSession();
    const { request, responses } = setup(
      fakeRuntime().runtime,
      async () => session,
    );
    await request({ id: 1, type: "open_session", cwd: "/work" });
    await request({ id: 2, type: "abort" });
    expect(session.abort).toHaveBeenCalled();
    expect(responses()[1]).toEqual({ type: "response", id: 2, ok: true });
  });

  it.each([
    { id: 1, type: "prompt", text: "Hi" },
    { id: 1, type: "abort" },
    { id: 1, type: "session_state" },
    { id: 1, type: "set_thinking_level", level: "high" },
    { id: 1, type: "set_model", provider: "anthropic", modelId: "opus" },
  ] as HostRequest[])("fails $type before a folder is open", async (r) => {
    const { request, responses } = setup(fakeRuntime().runtime);
    await request(r);
    expect(responses()[0]).toMatchObject({
      ok: false,
      error: "No folder is open.",
    });
  });
});

describe("toWireEvent", () => {
  it("leaves events other than message_update alone", () => {
    const event = { type: "message_end", message: { role: "user" } };
    expect(toWireEvent(event as SessionEvent)).toBe(event);
  });
});
