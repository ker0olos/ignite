// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type {
  HostMessage,
  HostRequest,
  McpServer,
  McpServerConfig,
  ModelInfo,
  ProjectTrust,
  ProviderStatus,
  ThinkingLevel,
} from "../shared/hostProtocol.ts";
import type { AgentMessage, SessionEvent } from "../shared/agentTypes.ts";
import { createHost } from "./host.ts";
import { describeError, toWireEvent } from "./wire.ts";
import type {
  McpCatalogSource,
  McpStatusSnapshot,
  OpenSession,
  Runtime,
  Session,
} from "./hostTypes.ts";
import type { ClaudeCode, ClaudeCodeStatus } from "./claudeCode.ts";
import { toConfig, type McpEntry, type McpStore } from "./mcpConfig.ts";
import { memoryStatus } from "./cmem.ts";
import type { TrustStore } from "./trust.ts";

const MEMORY = { state: "stopped", observations: [] } as const;
vi.mock("./cmem.ts", () => ({ memoryStatus: vi.fn(async () => MEMORY) }));

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
    reload: vi.fn(async () => {}),
    settingsManager: { setProjectTrusted: vi.fn() },
    extensionRunner: {
      emit: vi.fn(async () => {}),
      getCommand: vi.fn(
        (name: string): unknown =>
          [
            "mcp",
            "app-mcp-sign-in",
            "app-mcp-sign-out",
            "app-mcp-copy-sign-in",
          ].includes(name) || undefined,
      ),
    },
    dispose: vi.fn(),
  };
  return session satisfies Session;
}

type SavedServer = Omit<McpServer, "status">;

/** A fake mcp.json: servers in memory. */
function fakeMcpStore(servers: SavedServer[] = []) {
  const store = {
    servers,
    list: vi.fn(async () => store.servers),
    save: vi.fn(
      async (name: string, config: McpServerConfig, previousName?: string) => {
        const others = store.servers.filter(
          (m) => m.name !== (previousName ?? name),
        );
        store.servers = [...others, { name, enabled: true, config, tools: [] }];
      },
    ),
    remove: vi.fn(async (name: string) => {
      store.servers = store.servers.filter((m) => m.name !== name);
    }),
    setEnabled: vi.fn(async (name: string, enabled: boolean) => {
      store.servers = store.servers.map((m) =>
        m.name === name ? { ...m, enabled } : m,
      );
    }),
    signIns: [] as string[],
    needsSignIn: vi.fn(async () => store.signIns),
    setNeedsSignIn: vi.fn(async (name: string, needed: boolean) => {
      store.signIns = needed
        ? [...new Set([...store.signIns, name])]
        : store.signIns.filter((n) => n !== name);
    }),
    add: vi.fn(async (entries: Record<string, McpEntry>) => {
      const taken = store.servers.map((m) => m.name);
      const added = Object.entries(entries)
        .filter(([name]) => !taken.includes(name))
        .map(([name, entry]) => ({
          name,
          enabled: true,
          config: toConfig(entry),
          tools: [],
        }));
      store.servers = [...store.servers, ...added];
    }),
  };
  return store satisfies McpStore;
}

/** A fake Claude Code install; signed out unless told otherwise. */
function fakeClaudeCode(
  status: ClaudeCodeStatus = { installed: true, loggedIn: false },
  login: ClaudeCode["login"] = async () => {},
) {
  return { status: async () => status, login: vi.fn(login) };
}

/** A fake trust store: decisions in memory, "untrusted" by default. */
function fakeTrust(initial: Record<string, ProjectTrust> = {}) {
  const decisions = new Map(Object.entries(initial));
  return {
    decisions,
    get: vi.fn((cwd: string) => decisions.get(cwd) ?? "untrusted"),
    set: vi.fn((cwd: string, trusted: boolean) =>
      decisions.set(cwd, trusted ? "trusted" : "untrusted"),
    ),
  };
}

/** Wires a host to a fake runtime and records everything it sends. */
function setup(
  runtime: Runtime,
  openSession: OpenSession = async () => fakeSession(),
  claudeCode: ClaudeCode = fakeClaudeCode(),
  usesCodexLogin = async () => false,
  mcpStore: McpStore = fakeMcpStore(),
  catalog: McpCatalogSource = { presets: [], findImports: async () => [] },
  trust: TrustStore = fakeTrust(),
) {
  const sent: HostMessage[] = [];
  const host = createHost(
    runtime,
    (m) => sent.push(m),
    openSession,
    { claudeCode, usesCodexLogin },
    mcpStore,
    catalog,
    trust,
  );
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
    expect(openSession).toHaveBeenCalledWith(
      "/work",
      expect.any(Function),
      expect.any(Function),
    );
    expect(responses()[0]).toEqual({
      type: "response",
      id: 1,
      ok: true,
      data: {
        models: [opus, mini],
        model: opus,
        thinkingLevel: "low",
        thinkingLevels: ["off", "low", "high"],
        trust: "untrusted",
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

  it("shuts the previous session's extensions down when another folder opens", async () => {
    const first = fakeSession();
    const order: string[] = [];
    first.extensionRunner.emit.mockImplementation(async () => {
      order.push("shutdown");
    });
    first.dispose.mockImplementation(() => order.push("dispose"));
    const sessions = [first, fakeSession()];
    const { request } = setup(fakeRuntime().runtime, async () =>
      sessions.shift()!,
    );
    await request({ id: 1, type: "open_session", cwd: "/a" });
    await request({ id: 2, type: "open_session", cwd: "/b" });
    expect(first.extensionRunner.emit).toHaveBeenCalledWith({
      type: "session_shutdown",
      reason: "quit",
    });
    expect(order).toEqual(["shutdown", "dispose"]);
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

  it("sends attached images with a prompt", async () => {
    const session = fakeSession();
    const { request } = setup(fakeRuntime().runtime, async () => session);
    const images = [
      { type: "image" as const, data: "AA==", mimeType: "image/png" },
    ];
    await request({ id: 1, type: "open_session", cwd: "/work" });
    await request({ id: 2, type: "prompt", text: "What's this?", images });
    expect(session.prompt).toHaveBeenCalledWith("What's this?", { images });
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

describe("project trust", () => {
  it("reports the folder's trust when it opens", async () => {
    const trust = fakeTrust({ "/work": "ask" });
    const { request, responses } = setup(
      fakeRuntime().runtime,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      trust,
    );
    await request({ id: 1, type: "open_session", cwd: "/work" });
    expect(responses()[0]).toMatchObject({ data: { trust: "ask" } });
  });

  const trusting = (session = fakeSession()) => {
    const trust = fakeTrust({ "/work": "ask" });
    const host = setup(
      fakeRuntime().runtime,
      async () => session,
      undefined,
      undefined,
      undefined,
      undefined,
      trust,
    );
    return { ...host, trust, session };
  };

  it("saves trust and reloads the open folder's session with its resources", async () => {
    const { request, responses, trust, session } = trusting();
    await request({ id: 1, type: "open_session", cwd: "/work" });
    await request({ id: 2, type: "set_trust", cwd: "/work", trusted: true });
    expect(trust.set).toHaveBeenCalledWith("/work", true);
    expect(session.settingsManager.setProjectTrusted).toHaveBeenCalledWith(
      true,
    );
    expect(session.reload).toHaveBeenCalledOnce();
    expect(responses()[1]).toMatchObject({ id: 2, ok: true });
  });

  it("waits for the run to end before reloading", async () => {
    const { request, session } = trusting();
    await request({ id: 1, type: "open_session", cwd: "/work" });
    session.isStreaming = true;
    await request({ id: 2, type: "set_trust", cwd: "/work", trusted: true });
    expect(session.reload).not.toHaveBeenCalled();
    session.emit({ type: "agent_settled" } as SessionEvent);
    expect(session.reload).toHaveBeenCalledOnce();
  });

  it("saves a refusal without reloading", async () => {
    const { request, trust, session } = trusting();
    await request({ id: 1, type: "open_session", cwd: "/work" });
    await request({ id: 2, type: "set_trust", cwd: "/work", trusted: false });
    expect(trust.set).toHaveBeenCalledWith("/work", false);
    expect(session.settingsManager.setProjectTrusted).not.toHaveBeenCalled();
    expect(session.reload).not.toHaveBeenCalled();
  });

  it("only saves trust for a folder that isn't open", async () => {
    const { request, trust, session } = trusting();
    await request({ id: 1, type: "set_trust", cwd: "/other", trusted: true });
    await request({ id: 2, type: "open_session", cwd: "/work" });
    await request({ id: 3, type: "set_trust", cwd: "/other", trusted: true });
    expect(trust.set).toHaveBeenCalledTimes(2);
    expect(session.reload).not.toHaveBeenCalled();
  });
});

describe("tool approval", () => {
  type Ask = Parameters<Parameters<OpenSession>[2]>[0];
  /** Opens a session and returns a way to ask as the extension does. */
  const opened = async () => {
    let onApproval: (ask: Ask) => void = () => {};
    const session = fakeSession();
    const host = setup(fakeRuntime().runtime, async (_cwd, _status, ask) => {
      onApproval = ask;
      return session;
    });
    await host.request({ id: 1, type: "open_session", cwd: "/work" });
    const ask = (toolCallId: string, reason?: string) => {
      const answer = vi.fn();
      onApproval({ request: { toolCallId, reason }, answer });
      return answer;
    };
    return { ...host, session, ask, reopen: () => onApproval };
  };

  it("forwards the question and passes the user's answer back", async () => {
    const { ask, sent, request } = await opened();
    const answer = ask("t1", "Pipes text into a shell");
    expect(sent).toContainEqual({
      type: "approval_request",
      request: { toolCallId: "t1", reason: "Pipes text into a shell" },
    });
    await request({
      type: "approval_answer",
      toolCallId: "t1",
      approved: true,
    });
    expect(answer).toHaveBeenCalledWith(true);
    // Answered once; a second answer finds nothing waiting.
    await request({
      type: "approval_answer",
      toolCallId: "t1",
      approved: false,
    });
    expect(answer).toHaveBeenCalledOnce();
  });

  it("denies waiting calls when the run is stopped", async () => {
    const { ask, request, session } = await opened();
    const answer = ask("t1");
    await request({ id: 2, type: "abort" });
    expect(answer).toHaveBeenCalledWith(false);
    expect(session.abort).toHaveBeenCalled();
  });

  it("denies waiting calls when another folder opens", async () => {
    const { ask, request } = await opened();
    const answer = ask("t1");
    await request({ id: 2, type: "open_session", cwd: "/other" });
    expect(answer).toHaveBeenCalledWith(false);
  });

  it("denies a question from a session that was replaced", async () => {
    const { reopen, request, sent } = await opened();
    const stale = reopen();
    await request({ id: 2, type: "open_session", cwd: "/other" });
    const answer = vi.fn();
    stale({ request: { toolCallId: "old" }, answer });
    expect(answer).toHaveBeenCalledWith(false);
    expect(sent).not.toContainEqual(
      expect.objectContaining({ type: "approval_request" }),
    );
  });
});

describe("MCP servers", () => {
  const stdio: McpServerConfig = {
    type: "stdio",
    command: "npx",
    args: ["-y", "docs-mcp"],
    env: {},
  };
  const docs = {
    name: "docs",
    enabled: true,
    config: stdio,
    tools: ["search"],
  };
  const off = { name: "off", enabled: false, config: stdio, tools: [] };

  /**
   * A host with a folder open. `status` sends the first session's adapter
   * status; `sent` starts empty once the host has settled.
   */
  async function withSession(servers: SavedServer[] = [docs, off]) {
    const session = fakeSession();
    const store = fakeMcpStore(servers);
    const listeners: ((snapshot: McpStatusSnapshot) => void)[] = [];
    const openSession: OpenSession = async (_cwd, onMcpStatus) => {
      listeners.push(onMcpStatus);
      return listeners.length === 1 ? session : fakeSession();
    };
    const ctx = setup(
      fakeRuntime().runtime,
      openSession,
      fakeClaudeCode(),
      async () => false,
      store,
    );
    await ctx.request({ id: 1, type: "open_session", cwd: "/work" });
    await settle();
    ctx.sent.splice(0);
    const status = (s: McpStatusSnapshot) => listeners[0](s);
    return { ...ctx, session, store, status };
  }

  const settle = () => new Promise((r) => setTimeout(r));

  it("lists saved servers without a status while no folder is open", async () => {
    const { request, responses } = setup(
      fakeRuntime().runtime,
      undefined,
      undefined,
      undefined,
      fakeMcpStore([docs]),
    );
    await request({ id: 1, type: "mcp_list" });
    expect(responses()[0]).toEqual({
      type: "response",
      id: 1,
      ok: true,
      data: [docs],
    });
  });

  it("shows servers the adapter hasn't reported as idle, and disabled ones as off", async () => {
    const { request, responses } = await withSession();
    await request({ id: 2, type: "mcp_list" });
    expect(responses()[0]).toMatchObject({
      data: [
        { name: "docs", status: "idle" },
        { name: "off", status: "disabled" },
      ],
    });
  });

  it.each([
    ["connected", "connected"],
    ["cached", "idle"],
    ["not-connected", "idle"],
    ["failed", "failed"],
    ["needs-auth", "needs-auth"],
    ["disabled", "disabled"],
    ["something-new", "idle"],
  ])("pushes the adapter's %s status as %s", async (adapter, shown) => {
    const { sent, status } = await withSession([docs]);
    status({ servers: [{ name: "docs", status: adapter }] });
    expect(await waitFor(sent, "mcp_servers")).toEqual({
      type: "mcp_servers",
      servers: [{ ...docs, status: shown }],
    });
  });

  describe("remembering sign-in", () => {
    it("remembers a server needs sign-in until it connects", async () => {
      const { sent, status, store } = await withSession([docs]);
      status({ servers: [{ name: "docs", status: "needs-auth" }] });
      await waitFor(sent, "mcp_servers");
      expect(store.signIns).toEqual(["docs"]);
      sent.splice(0);
      status({ servers: [{ name: "docs", status: "connected" }] });
      await waitFor(sent, "mcp_servers");
      expect(store.signIns).toEqual([]);
    });

    it("says so after a restart, before the adapter connects it", async () => {
      const store = fakeMcpStore([docs]);
      store.signIns = ["docs"];
      const { request, responses } = setup(
        fakeRuntime().runtime,
        undefined,
        undefined,
        undefined,
        store,
      );
      await request({ id: 1, type: "open_session", cwd: "/work" });
      await request({ id: 2, type: "mcp_list" });
      expect(responses()[1]).toMatchObject({
        data: [{ name: "docs", status: "needs-auth" }],
      });
    });

    it("lets a real status win over the remembered one", async () => {
      const { request, responses, status, store } = await withSession([docs]);
      store.signIns = ["docs"];
      status({ servers: [{ name: "docs", status: "failed" }] });
      await request({ id: 2, type: "mcp_list" });
      expect(responses().at(-1)).toMatchObject({
        data: [{ name: "docs", status: "failed" }],
      });
    });
  });

  it("pushes the servers' status once a folder opens", async () => {
    const { request, sent } = setup(
      fakeRuntime().runtime,
      undefined,
      undefined,
      undefined,
      fakeMcpStore([docs, off]),
    );
    await request({ id: 1, type: "open_session", cwd: "/work" });
    expect(await waitFor(sent, "mcp_servers")).toMatchObject({
      servers: [{ status: "idle" }, { status: "disabled" }],
    });
  });

  it("keeps status the adapter reports while the session is opening", async () => {
    const openSession: OpenSession = async (_cwd, onMcpStatus) => {
      onMcpStatus({ servers: [{ name: "docs", status: "connected" }] });
      return fakeSession();
    };
    const { request, sent } = setup(
      fakeRuntime().runtime,
      openSession,
      undefined,
      undefined,
      fakeMcpStore([docs]),
    );
    await request({ id: 1, type: "open_session", cwd: "/work" });
    await settle();
    expect(sent.filter((m) => m.type === "mcp_servers")).toEqual([
      { type: "mcp_servers", servers: [{ ...docs, status: "connected" }] },
    ]);
  });

  it("ignores status from a session that was replaced", async () => {
    const { request, sent, status } = await withSession();
    await request({ id: 2, type: "open_session", cwd: "/other" });
    await settle();
    sent.splice(0);
    status({ servers: [{ name: "docs", status: "connected" }] });
    await settle();
    expect(sent).toEqual([]);
  });

  it("pushes nothing when mcp.json can't be read", async () => {
    const { sent, status, store } = await withSession();
    store.list.mockRejectedValue(new Error("bad json"));
    status({ servers: [] });
    await settle();
    expect(sent).toEqual([]);
  });

  it("saves a server and reloads the session so it applies", async () => {
    const { request, responses, session, store } = await withSession([]);
    await request({ id: 2, type: "mcp_save", name: "docs", config: stdio });
    expect(store.save).toHaveBeenCalledWith("docs", stdio, undefined);
    expect(session.reload).toHaveBeenCalled();
    expect(responses()[0]).toMatchObject({
      ok: true,
      data: [{ name: "docs", status: "idle" }],
    });
  });

  it("passes the old name when renaming", async () => {
    const { request, store } = await withSession();
    await request({
      id: 2,
      type: "mcp_save",
      name: "docs2",
      config: stdio,
      previousName: "docs",
    });
    expect(store.save).toHaveBeenCalledWith("docs2", stdio, "docs");
  });

  it("saves without a session and reloads nothing", async () => {
    const store = fakeMcpStore();
    const { request, responses } = setup(
      fakeRuntime().runtime,
      undefined,
      undefined,
      undefined,
      store,
    );
    await request({ id: 1, type: "mcp_save", name: "docs", config: stdio });
    expect(responses()[0]).toMatchObject({
      ok: true,
      data: [{ name: "docs", enabled: true }],
    });
  });

  it("waits for the run to end before reloading", async () => {
    const { request, session } = await withSession();
    session.isStreaming = true;
    await request({ id: 2, type: "mcp_remove", name: "docs" });
    expect(session.reload).not.toHaveBeenCalled();
    session.emit({ type: "agent_settled" } as SessionEvent);
    expect(session.reload).toHaveBeenCalledTimes(1);
    session.emit({ type: "agent_settled" } as SessionEvent);
    expect(session.reload).toHaveBeenCalledTimes(1);
  });

  it("reloads the session when the memory setting changes", async () => {
    const { request, responses, session } = await withSession();
    await request({ id: 2, type: "memory_changed" });
    expect(session.reload).toHaveBeenCalledTimes(1);
    expect(responses()[0]).toMatchObject({ ok: true });
  });

  it("reports cmem's status for the folder", async () => {
    const { request, responses } = await withSession();
    await request({ id: 2, type: "memory_status", cwd: "/work/app" });
    expect(memoryStatus).toHaveBeenCalledWith("/work/app");
    expect(responses()[0]).toMatchObject({ ok: true, data: MEMORY });
  });

  describe("checking a URL server once it's set up", () => {
    const web: McpServerConfig = {
      type: "http",
      url: "https://x.dev/mcp",
      headers: {},
    };
    const statusOf = (response: HostMessage, name: string) =>
      (response as { data: McpServer[] }).data.find((m) => m.name === name)
        ?.status;
    const checks = (session: ReturnType<typeof fakeSession>) =>
      session.prompt.mock.calls.filter(
        ([text]: unknown[]) => text === "/mcp reconnect web",
      );

    it("connects a saved URL server once, so a needed sign-in shows", async () => {
      const { request, responses, session, sent } = await withSession();
      let finish = () => {};
      session.prompt.mockReturnValue(new Promise<void>((r) => (finish = r)));
      await request({ id: 2, type: "mcp_save", name: "web", config: web });
      await vi.waitFor(() => expect(checks(session)).toHaveLength(1));
      expect(statusOf(responses()[0], "web")).toBe("checking");

      sent.splice(0);
      finish();
      const pushed = (await waitFor(sent, "mcp_servers")) as {
        servers: { name: string; status: string }[];
      };
      expect(pushed.servers.find((m) => m.name === "web")?.status).toBe("idle");
    });

    it("stops showing a check once another folder opens", async () => {
      const { request, responses, session } = await withSession();
      session.prompt.mockReturnValue(new Promise<void>(() => {}));
      await request({ id: 2, type: "mcp_save", name: "web", config: web });
      await request({ id: 3, type: "open_session", cwd: "/other" });
      await request({ id: 4, type: "mcp_list" });
      expect(statusOf(responses().at(-1)!, "web")).toBe("idle");
    });

    it("leaves local command servers to connect when used", async () => {
      const { request, session } = await withSession();
      await request({ id: 2, type: "mcp_save", name: "web", config: stdio });
      await settle();
      expect(session.prompt).not.toHaveBeenCalled();
    });

    it("skips servers that are off, or while pi is running", async () => {
      const { request, session, store } = await withSession();
      await request({ id: 2, type: "mcp_save", name: "web", config: web });
      await vi.waitFor(() => expect(checks(session)).toHaveLength(1));
      session.prompt.mockClear();
      await request({
        id: 3,
        type: "mcp_set_enabled",
        name: "web",
        enabled: false,
      });
      store.servers = store.servers.map((m) => ({ ...m, enabled: false }));
      session.isStreaming = true;
      await request({ id: 4, type: "mcp_save", name: "web", config: web });
      await settle();
      expect(session.prompt).not.toHaveBeenCalled();
    });

    it("skips the check without the adapter, and ignores a failed one", async () => {
      const { request, session } = await withSession();
      session.prompt.mockRejectedValue(new Error("offline"));
      await request({ id: 2, type: "mcp_save", name: "web", config: web });
      await vi.waitFor(() => expect(checks(session)).toHaveLength(1));

      session.prompt.mockClear();
      session.extensionRunner.getCommand.mockReturnValue(undefined);
      await request({ id: 3, type: "mcp_save", name: "web", config: web });
      await settle();
      expect(session.prompt).not.toHaveBeenCalled();
    });
  });

  describe("removing a server", () => {
    const signOuts = (session: ReturnType<typeof fakeSession>) =>
      session.prompt.mock.calls.filter(
        ([text]: unknown[]) => text === "/app-mcp-sign-out docs",
      );

    it("deletes its saved sign-in first", async () => {
      const { request, session, store } = await withSession();
      await request({ id: 2, type: "mcp_remove", name: "docs" });
      expect(signOuts(session)).toHaveLength(1);
      expect(store.remove).toHaveBeenCalledWith("docs");
    });

    it("deletes it when the next folder opens if it can't now", async () => {
      const second = fakeSession();
      const first = fakeSession();
      first.prompt.mockRejectedValue(new Error("busy"));
      const sessions = [first, second];
      const store = fakeMcpStore([docs]);
      const { request } = setup(
        fakeRuntime().runtime,
        async () => sessions.shift()!,
        undefined,
        undefined,
        store,
      );
      await request({ id: 1, type: "open_session", cwd: "/a" });
      await request({ id: 2, type: "mcp_remove", name: "docs" });
      expect(store.remove).toHaveBeenCalledWith("docs");
      await request({ id: 3, type: "open_session", cwd: "/b" });
      expect(second.prompt).toHaveBeenCalledWith("/app-mcp-sign-out docs", {});
      await request({ id: 4, type: "open_session", cwd: "/c" });
    });

    it("waits for a folder when none is open", async () => {
      const session = fakeSession();
      const store = fakeMcpStore([docs]);
      const { request } = setup(
        fakeRuntime().runtime,
        async () => session,
        undefined,
        undefined,
        store,
      );
      await request({ id: 1, type: "mcp_remove", name: "docs" });
      expect(store.remove).toHaveBeenCalledWith("docs");
      await request({ id: 2, type: "open_session", cwd: "/a" });
      expect(signOuts(session)).toHaveLength(1);
    });
  });

  it("reports a reload that fails after the run", async () => {
    const { request, session, sent } = await withSession();
    session.isStreaming = true;
    session.reload.mockRejectedValue(new Error("extension broke"));
    await request({
      id: 2,
      type: "mcp_set_enabled",
      name: "docs",
      enabled: false,
    });
    session.emit({ type: "agent_settled" } as SessionEvent);
    expect(await waitFor(sent, "session_error")).toEqual({
      type: "session_error",
      error: "extension broke",
    });
  });

  it("turns a server off and on", async () => {
    const { request, responses, store } = await withSession();
    await request({
      id: 2,
      type: "mcp_set_enabled",
      name: "docs",
      enabled: false,
    });
    expect(store.setEnabled).toHaveBeenCalledWith("docs", false);
    expect(responses()[0]).toMatchObject({
      data: [{ name: "docs", enabled: false, status: "disabled" }, off],
    });
  });

  it("removes a server", async () => {
    const { request, responses, store } = await withSession();
    await request({ id: 2, type: "mcp_remove", name: "off" });
    expect(store.remove).toHaveBeenCalledWith("off");
    expect(responses()[0]).toMatchObject({ data: [{ name: "docs" }] });
  });

  it("reports a change mcp.json refused", async () => {
    const { request, responses, session, store } = await withSession();
    store.save.mockRejectedValue(new Error("Enter a command."));
    await request({ id: 2, type: "mcp_save", name: "x", config: stdio });
    expect(responses()[0]).toMatchObject({
      ok: false,
      error: "Enter a command.",
    });
    expect(session.reload).not.toHaveBeenCalled();
  });

  it("signs in with the adapter's command, then connects", async () => {
    const { request, responses, session } = await withSession();
    await request({ id: 2, type: "mcp_sign_in", name: "docs" });
    expect(session.prompt).toHaveBeenNthCalledWith(
      1,
      "/app-mcp-sign-in docs",
      {},
    );
    expect(session.prompt).toHaveBeenNthCalledWith(
      2,
      "/mcp reconnect docs",
      {},
    );
    expect(responses()[0]).toMatchObject({ ok: true });
  });

  it("can't sign in without the adapter's sign-in command", async () => {
    const { request, responses, session } = await withSession();
    session.extensionRunner.getCommand.mockImplementation(
      (name: string) => name === "mcp" || undefined,
    );
    await request({ id: 2, type: "mcp_sign_in", name: "docs" });
    expect(responses()[0]).toMatchObject({
      ok: false,
      error: "MCP sign-in isn't available in this session.",
    });
    expect(session.prompt).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", "There is no server named missing."],
    ["off", "Turn off on first."],
  ])("won't sign in to %s", async (name, error) => {
    const { request, responses, session } = await withSession();
    await request({ id: 2, type: "mcp_sign_in", name });
    expect(responses()[0]).toMatchObject({ ok: false, error });
    expect(session.prompt).not.toHaveBeenCalled();
  });

  it("won't send the command to the model when the adapter isn't loaded", async () => {
    const { request, responses, session } = await withSession();
    session.extensionRunner.getCommand.mockReturnValue(undefined);
    await request({ id: 2, type: "mcp_sign_in", name: "docs" });
    expect(responses()[0]).toMatchObject({
      ok: false,
      error: "MCP isn't running in this session. Check mcp.json.",
    });
    expect(session.prompt).not.toHaveBeenCalled();
  });

  it("can't sign in before a folder is open", async () => {
    const { request, responses } = setup(fakeRuntime().runtime);
    await request({ id: 1, type: "mcp_sign_in", name: "docs" });
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

describe("MCP catalog", () => {
  const stdio = { command: "npx", args: ["-y", "pkg"] };
  const presets = [
    {
      id: "context7",
      name: "Context7",
      summary: "Docs.",
      entry: { url: "https://c7" },
    },
    {
      id: "sentry",
      name: "Sentry",
      summary: "Errors.",
      entry: { url: "https://sentry", auth: "oauth" },
    },
  ];
  const sources = [
    {
      id: "claude-code",
      app: "Claude Code",
      scope: "user" as const,
      servers: {
        "my docs": { url: "https://docs" },
        blender: stdio,
        bare: { command: "uvx" },
      },
    },
  ];

  function withCatalog() {
    const store = fakeMcpStore([
      {
        name: "context7",
        enabled: true,
        config: toConfig({ url: "https://c7" }),
        tools: [],
      },
    ]);
    const cwds: (string | undefined)[] = [];
    const session = fakeSession();
    const ctx = setup(
      fakeRuntime().runtime,
      async () => session,
      undefined,
      undefined,
      store,
      {
        presets,
        findImports: async (cwd) => {
          cwds.push(cwd);
          return sources;
        },
      },
    );
    return { ...ctx, store, cwds, session };
  }

  const data = <T>(r: HostMessage) => (r as { data: T }).data;

  it("lists presets and other apps' servers, marking what's already added", async () => {
    const { request, responses, cwds } = withCatalog();
    await request({ id: 1, type: "mcp_catalog" });
    expect(data(responses()[0])).toEqual({
      presets: [
        {
          id: "context7",
          name: "Context7",
          summary: "Docs.",
          signIn: false,
          added: true,
        },
        {
          id: "sentry",
          name: "Sentry",
          summary: "Errors.",
          signIn: true,
          added: false,
        },
      ],
      sources: [
        {
          id: "claude-code",
          app: "Claude Code",
          scope: "user",
          servers: [
            { name: "my docs", target: "https://docs", added: false },
            { name: "blender", target: "npx -y pkg", added: false },
            { name: "bare", target: "uvx", added: false },
          ],
        },
      ],
    });
    expect(cwds).toEqual([undefined]);
  });

  it("looks for project servers in the given folder", async () => {
    const { request, cwds } = withCatalog();
    await request({ id: 1, type: "mcp_catalog", cwd: "/work" });
    await request({
      id: 2,
      type: "mcp_import",
      source: "claude-code",
      names: [],
      cwd: "/work",
    });
    expect(cwds).toEqual(["/work", "/work"]);
  });

  it("adds a preset under its id", async () => {
    const { request, responses, store } = withCatalog();
    await request({ id: 1, type: "mcp_add_preset", preset: "sentry" });
    expect(store.add).toHaveBeenCalledWith({ sentry: presets[1].entry });
    expect(data<{ name: string }[]>(responses()[0]).map((s) => s.name)).toEqual(
      ["context7", "sentry"],
    );
  });

  it("refuses an unknown preset", async () => {
    const { request, responses } = withCatalog();
    await request({ id: 1, type: "mcp_add_preset", preset: "nope" });
    expect(responses()[0]).toMatchObject({
      ok: false,
      error: "There is no preset named nope.",
    });
  });

  it("imports the chosen servers, making their names safe for tool names", async () => {
    const { request, store } = withCatalog();
    await request({
      id: 1,
      type: "mcp_import",
      source: "claude-code",
      names: ["my docs"],
    });
    expect(store.add).toHaveBeenCalledWith({
      "my-docs": { url: "https://docs" },
    });
  });

  it("copies Claude Code's sign-ins for imported URL servers", async () => {
    const { request, session } = withCatalog();
    await request({ id: 1, type: "open_session", cwd: "/work" });
    await request({
      id: 2,
      type: "mcp_import",
      source: "claude-code",
      names: ["my docs", "blender"],
    });
    const copies = session.prompt.mock.calls
      .map(([text]: unknown[]) => text)
      .filter((text: unknown) => String(text).startsWith("/app-mcp-copy"));
    expect(copies).toEqual(["/app-mcp-copy-sign-in my-docs"]);
  });

  it("refuses an import from a source that's gone", async () => {
    const { request, responses } = withCatalog();
    await request({ id: 1, type: "mcp_import", source: "cursor", names: [] });
    expect(responses()[0]).toMatchObject({
      ok: false,
      error: "Those servers are no longer there.",
    });
  });
});
