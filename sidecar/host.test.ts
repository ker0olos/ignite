// @vitest-environment node
import type { StreamFn } from "./compactProgress.ts";
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
import { skippable } from "./skipWait.ts";
import { createTaskStore } from "./taskStore.ts";
import { createSearch } from "./search.ts";
import { describeError, toWireEvent } from "./wire.ts";
import type {
  McpCatalogSource,
  McpStatusSnapshot,
  OpenSession,
  Runtime,
  Session,
  SessionStore,
  HostContext,
} from "./hostTypes.ts";
import type { ClaudeCode, ClaudeCodeStatus } from "./claudeCode.ts";
import { toConfig, type McpEntry, type McpStore } from "./mcpConfig.ts";
import { memoryStatus } from "./cmem.ts";
import type { TrustStore } from "./trust.ts";
import type { SkillStore } from "./skillStore.ts";
import type { Task } from "../shared/tasks.ts";

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
    modelRuntime: {
      getAvailable: async (): Promise<ModelInfo[]> => MODELS,
      // No catalog, so the router never routes these sessions; router.test.ts covers it.
      getModels: () => [],
      completeSimple: vi.fn(),
      getAuth: vi.fn(
        async (): Promise<
          { auth: { apiKey?: string; headers?: unknown } } | undefined
        > => ({ auth: { apiKey: "key" } }),
      ),
    },
    model: OPUS as ModelInfo | undefined,
    thinkingLevel: "low" as ThinkingLevel,
    getAvailableThinkingLevels: () => levels(session.model),
    resourceLoader: {
      getSkills: () => ({ skills: [{ name: "review", description: "R" }] }),
    },
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
    agent: {
      state: { messages: [] as AgentMessage[] },
      streamFunction: (() => undefined) as StreamFn,
    },
    sessionManager: { appendMessage: vi.fn(() => "entry") },
    sendCustomMessage: vi.fn(async () => {}),
    isStreaming: false,
    listeners: new Set<(e: SessionEvent) => void>(),
    subscribe: vi.fn((cb: (e: SessionEvent) => void) => {
      session.listeners.add(cb);
      return () => void session.listeners.delete(cb);
    }),
    emit: (e: SessionEvent) => session.listeners.forEach((cb) => cb(e)),
    queue: { steering: [] as string[], followUp: [] as string[] },
    // Like pi: a prompt sent while it streams waits in a queue.
    prompt: vi.fn(
      async (
        text: string,
        o: { streamingBehavior?: "steer" | "followUp" } = {},
      ) => {
        if (!session.isStreaming) return;
        const kind =
          o.streamingBehavior === "followUp" ? "followUp" : "steering";
        session.queue[kind].push(text);
      },
    ),
    steer: vi.fn(async (text: string) => {
      session.queue.steering.push(text);
    }),
    followUp: vi.fn(async (text: string) => {
      session.queue.followUp.push(text);
    }),
    abort: vi.fn(async () => {
      session.isStreaming = false;
    }),
    compact: vi.fn<(instructions?: string) => Promise<unknown>>(
      async () => ({}),
    ),
    clearQueue: vi.fn(() => {
      const taken = session.queue;
      session.queue = { steering: [], followUp: [] };
      return taken;
    }),
    getSteeringMessages: () => session.queue.steering,
    getFollowUpMessages: () => session.queue.followUp,
    get pendingMessageCount() {
      return session.queue.steering.length + session.queue.followUp.length;
    },
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

/** A fake session store: new ids count up. */
function fakeSessions(saved: Awaited<ReturnType<SessionStore["list"]>> = []) {
  let next = 0;
  return {
    create: () => `new${++next}`,
    list: vi.fn(async () => saved),
    extras: vi.fn(async () => ({ branch: "feat/x" })),
    read: vi.fn(async (): Promise<AgentMessage[]> => [
      { role: "user", content: "from the file", timestamp: 1 },
    ]),
  } satisfies SessionStore;
}

/** Fake worktrees: agents work in the folder itself. */
function fakeWorkspaces() {
  return {
    open: vi.fn(async (folder: string) => ({
      dir: folder,
      ready: Promise.resolve(),
    })),
    close: vi.fn(async () => {}),
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
  sessions: SessionStore = fakeSessions(),
  workspaces: HostContext["workspaces"] = fakeWorkspaces(),
  draft: HostContext["draft"] = async () => fakeSession(),
  search?: HostContext["search"],
  skills?: SkillStore,
) {
  const sent: HostMessage[] = [];
  const tasks = createTaskStore(null);
  const mcp = fakeSession();
  let onMcpStatus: (snapshot: McpStatusSnapshot) => void = () => {};
  const openMcpSession = vi.fn(async (listener: typeof onMcpStatus) => {
    onMcpStatus = listener;
    return mcp;
  });
  const host = createHost(
    runtime,
    (m) => sent.push(m),
    openSession,
    sessions,
    workspaces,
    draft,
    { claudeCode, usesCodexLogin },
    mcpStore,
    openMcpSession,
    catalog,
    trust,
    skills as SkillStore,
    tasks,
    undefined,
    search,
  );
  const responses = () => sent.filter((m) => m.type === "response");
  const request = async (r: HostRequest) => host.handle(r);
  const mcpStatus = (s: McpStatusSnapshot) => onMcpStatus(s);
  return {
    host,
    sent,
    responses,
    request,
    tasks,
    mcp,
    openMcpSession,
    mcpStatus,
  };
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
    const ids = async (loggedIn: boolean) => {
      const { request, responses } = setup(
        fakeRuntime().runtime,
        async () => ({
          ...fakeSession(),
          modelRuntime: {
            ...fakeSession().modelRuntime,
            getAvailable: async () => [...MODELS, bridged],
          },
        }),
        fakeClaudeCode({ installed: true, loggedIn }),
      );
      await request({
        id: 1,
        type: "open_session",
        cwd: "/work",
        session: "/work:saved",
      });
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

describe("skip_wait", () => {
  it("ends the running bash call, and says when none runs", async () => {
    const { runtime } = fakeRuntime();
    const { request, responses } = setup(runtime);
    const run = skippable(
      "c1",
      undefined,
      (signal) =>
        new Promise((_, reject) =>
          signal.addEventListener("abort", () => reject(new Error("aborted"))),
        ),
    );
    await request({ id: 1, type: "skip_wait", toolCallId: "c1" });
    await expect(run).resolves.toMatchObject({ details: { skipped: true } });
    await request({ id: 2, type: "skip_wait", toolCallId: "c1" });
    expect(responses()).toMatchObject([{ data: true }, { data: false }]);
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
    await request({
      id: 1,
      type: "open_session",
      cwd: "/work",
      session: "/work:saved",
    });
    expect(openSession).toHaveBeenCalledWith(
      "/work",
      "/work",
      "/work:saved",
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
        skills: [{ name: "review", description: "R" }],
        session: "/work:saved",
        workdir: "/work",
        trust: "untrusted",
        messages: [],
        running: false,
        approvals: [],
        queue: { steering: [], followUp: [] },
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
    await request({
      id: 1,
      type: "open_session",
      cwd: "/work",
      session: "/work:saved",
    });
    expect(responses()[0]).toMatchObject({
      data: { messages: [hello], running: true },
    });
  });

  it("resumes a run a reload cut off, once, after replying", async () => {
    const session = fakeSession();
    session.messages = [{ role: "user", content: "hi", timestamp: 1 }];
    const { request } = setup(fakeRuntime().runtime, async () => session);
    const open = { type: "open_session", cwd: "/work", session: "s1" } as const;
    await request({ id: 1, ...open });
    expect(session.sendCustomMessage).not.toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(session.sendCustomMessage).toHaveBeenCalledOnce(),
    );
    await request({ id: 2, ...open });
    await new Promise((r) => setTimeout(r));
    expect(session.sendCustomMessage).toHaveBeenCalledOnce();
  });

  it("passes on why the saved model wasn't used", async () => {
    const { request, responses } = setup(fakeRuntime().runtime, async () => ({
      ...fakeSession(),
      modelWarning: "opus isn't available; using Mini.",
    }));
    await request({
      id: 1,
      type: "open_session",
      cwd: "/work",
      session: "/work:saved",
    });
    expect(responses()[0]).toMatchObject({
      data: { modelWarning: "opus isn't available; using Mini." },
    });
  });

  it("reports a session with no model yet", async () => {
    const { request, responses } = setup(fakeRuntime().runtime, async () => ({
      ...fakeSession(),
      model: undefined,
    }));
    await request({
      id: 1,
      type: "open_session",
      cwd: "/work",
      session: "/work:saved",
    });
    const data = (responses()[0] as { data: { model?: unknown } }).data;
    expect(data.model).toBeUndefined();
  });

  it("keeps a folder's session running while another is shown", async () => {
    const first = fakeSession();
    const openSession = vi.fn<OpenSession>(async () => first);
    const { request, responses } = setup(fakeRuntime().runtime, openSession);
    await request({
      id: 1,
      type: "open_session",
      cwd: "/a",
      session: "/a:saved",
    });
    openSession.mockImplementation(async () => fakeSession());
    await request({
      id: 2,
      type: "open_session",
      cwd: "/b",
      session: "/b:saved",
    });
    await request({
      id: 3,
      type: "open_session",
      cwd: "/a",
      session: "/a:saved",
    });
    expect(openSession.mock.calls.map((c) => c[0])).toEqual(["/a", "/b"]);
    expect(first.dispose).not.toHaveBeenCalled();
    expect(responses()[2]).toMatchObject({ id: 3, ok: true });
  });

  it("shuts a closed folder's extensions down, then disposes it", async () => {
    const first = fakeSession();
    const order: string[] = [];
    first.extensionRunner.emit.mockImplementation(async () => {
      order.push("shutdown");
    });
    first.dispose.mockImplementation(() => order.push("dispose"));
    const { request, sent } = setup(fakeRuntime().runtime, async () => first);
    await request({
      id: 1,
      type: "open_session",
      cwd: "/a",
      session: "/a:saved",
    });
    await request({ id: 2, type: "close_session", cwd: "/a" });
    expect(first.extensionRunner.emit).toHaveBeenCalledWith({
      type: "session_shutdown",
      reason: "quit",
    });
    expect(order).toEqual(["shutdown", "dispose"]);
    expect(await waitFor(sent, "agents")).toEqual({
      type: "agents",
      agents: [],
    });
  });

  it("waits for a session that's still opening", async () => {
    const noop = () => {};
    let finish: (s: Session) => void = noop;
    const { request, responses } = setup(
      fakeRuntime().runtime,
      () => new Promise<Session>((resolve) => (finish = resolve)),
    );
    const opening = request({
      id: 1,
      type: "open_session",
      cwd: "/a",
      session: "/a:saved",
    });
    const state = request({ id: 2, type: "session_state" });
    await vi.waitFor(() => expect(finish).not.toBe(noop));
    finish(fakeSession());
    await Promise.all([opening, state]);
    expect(responses().find((r) => r.id === 2)).toMatchObject({ ok: true });
  });

  it("opens a folder again after its session failed to open", async () => {
    const openSession = vi.fn<OpenSession>(async () => {
      throw new Error("No model.");
    });
    const { request, responses } = setup(fakeRuntime().runtime, openSession);
    await request({
      id: 1,
      type: "open_session",
      cwd: "/a",
      session: "/a:saved",
    });
    openSession.mockImplementation(async () => fakeSession());
    await request({
      id: 2,
      type: "open_session",
      cwd: "/a",
      session: "/a:saved",
    });
    expect(responses()[0]).toMatchObject({ ok: false, error: "No model." });
    expect(responses()[1]).toMatchObject({ ok: true });
  });

  it("reports which folders are working", async () => {
    const session = fakeSession();
    const { request, sent } = setup(fakeRuntime().runtime, async () => session);
    await request({
      id: 1,
      type: "open_session",
      cwd: "/a",
      session: "/a:saved",
    });
    session.emit({ type: "agent_start" });
    expect(await waitFor(sent, "agents")).toEqual({
      type: "agents",
      agents: [
        {
          cwd: "/a",
          session: "/a:saved",
          title: "",
          running: true,
          waiting: false,
        },
      ],
    });
    session.emit({ type: "agent_settled" });
    expect(await waitFor(sent, "agents")).toMatchObject({
      agents: [{ running: false }],
    });
  });

  it("names a conversation after its first message, and keeps that name", async () => {
    const session = fakeSession();
    const { request, sent } = setup(fakeRuntime().runtime, async () => session);
    await request({ id: 1, type: "new_session", cwd: "/a" });
    // Named from the event itself: pi adds it to messages only afterwards.
    const say = (content: string) =>
      session.emit({
        type: "message_start",
        message: { role: "user", content, timestamp: 1 },
      });
    say("Fix the login bug\nIt 500s");
    expect(await waitFor(sent, "agents")).toMatchObject({
      agents: [{ title: "Fix the login bug" }],
    });
    say("Now the tests");
    expect(await waitFor(sent, "agents")).toMatchObject({
      agents: [{ title: "Fix the login bug" }],
    });
  });

  it("names a reopened conversation after its first saved message", async () => {
    const session = fakeSession();
    session.messages = [
      { role: "user", content: "Started with this", timestamp: 1 },
      { role: "user", content: "Then this", timestamp: 2 },
    ];
    const { request, sent } = setup(fakeRuntime().runtime, async () => session);
    await request({ id: 1, type: "open_session", cwd: "/a", session: "s" });
    expect(await waitFor(sent, "agents")).toMatchObject({
      agents: [{ title: "Started with this" }],
    });
  });

  it("runs several conversations in one folder", async () => {
    const [a, b] = [fakeSession(), fakeSession()];
    const sessions = [a, b];
    const { request, responses, sent } = setup(
      fakeRuntime().runtime,
      async () => sessions.shift()!,
    );
    await request({
      id: 1,
      type: "open_session",
      cwd: "/work",
      session: "/work:saved",
    });
    await request({ id: 2, type: "new_session", cwd: "/work" });
    expect(responses()[1]).toMatchObject({ data: { session: "new1" } });
    sent.splice(0);
    a.emit({ type: "agent_start" });
    b.emit({ type: "agent_start" });
    // Only the shown one's events reach the app; both report working.
    expect(sent.filter((m) => m.type === "session_event")).toEqual([
      {
        type: "session_event",
        session: "new1",
        event: { type: "agent_start" },
      },
    ]);
    expect(sent.at(-1)).toMatchObject({
      agents: [
        { session: "/work:saved", running: true },
        { session: "new1", running: true },
      ],
    });
    await request({ id: 3, type: "prompt", text: "hi" });
    expect(b.prompt).toHaveBeenCalled();
    expect(a.prompt).not.toHaveBeenCalled();
    await request({
      id: 4,
      type: "open_session",
      cwd: "/work",
      session: "/work:saved",
    });
    expect(responses().at(-1)).toMatchObject({
      data: { session: "/work:saved" },
    });
    await request({ id: 5, type: "prompt", text: "again" });
    expect(a.prompt).toHaveBeenCalled();
  });

  it("shows a folder's last shown conversation when it's shown again", async () => {
    const { request, responses } = setup(fakeRuntime().runtime);
    await request({
      id: 1,
      type: "open_session",
      cwd: "/work",
      session: "/work:saved",
    });
    await request({ id: 2, type: "new_session", cwd: "/work" });
    await request({ id: 3, type: "new_session", cwd: "/other" });
    await request({ id: 4, type: "open_session", cwd: "/work" });
    expect(responses()[3]).toMatchObject({ data: { session: "new1" } });
    // Once it's closed, another of the folder's open ones.
    await request({
      id: 5,
      type: "close_session",
      cwd: "/work",
      session: "new1",
    });
    await request({ id: 6, type: "open_session", cwd: "/work" });
    expect(responses()[5]).toMatchObject({ data: { session: "/work:saved" } });
  });

  it("tells what a new conversation would start with, from the draft session", async () => {
    const draft = vi.fn(async () => fakeSession());
    const { request, responses } = setup(
      fakeRuntime().runtime,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      draft,
      undefined,
      {
        sessionSkills: () => ({
          skills: [{ name: "code-review", description: "C" }],
        }),
      } as unknown as SkillStore,
    );
    await request({
      id: 1,
      type: "draft_state",
      model: { provider: "openai", id: "mini" },
    });
    expect(draft).toHaveBeenCalledWith({
      model: { provider: "openai", id: "mini" },
      level: undefined,
    });
    expect(responses()[0]).toMatchObject({
      ok: true,
      data: {
        models: [opus, mini],
        model: opus,
        thinkingLevel: "low",
        // The app's skills, not the draft's.
        skills: [{ name: "code-review", description: "C" }],
      },
    });
  });

  it("reads a conversation's messages without starting it, or from its running session", async () => {
    const session = fakeSession();
    session.messages = [{ role: "user", content: "live", timestamp: 2 }];
    const openSession = vi.fn<OpenSession>(async () => session);
    const { request, responses } = setup(fakeRuntime().runtime, openSession);
    await request({ id: 1, type: "read_session", cwd: "/work", session: "s" });
    expect(openSession).not.toHaveBeenCalled();
    expect(responses()[0]).toMatchObject({
      data: [{ content: "from the file" }],
    });
    await request({ id: 2, type: "open_session", cwd: "/work", session: "s" });
    await request({ id: 3, type: "read_session", cwd: "/work", session: "s" });
    expect(responses()[2]).toMatchObject({ data: [{ content: "live" }] });
  });

  it("acts on the conversation a request names, even with another shown", async () => {
    const [a, b] = [fakeSession(), fakeSession()];
    const sessions = [a, b];
    const { request, responses } = setup(fakeRuntime().runtime, async () =>
      sessions.shift()!,
    );
    await request({ id: 1, type: "new_session", cwd: "/work" });
    await request({ id: 2, type: "new_session", cwd: "/work" });
    await request({ id: 3, type: "prompt", text: "hi", session: "new1" });
    await request({
      id: 4,
      type: "set_thinking_level",
      level: "high",
      session: "new1",
    });
    await request({ id: 5, type: "abort", session: "new1" });
    expect(a.prompt).toHaveBeenCalled();
    expect(a.setThinkingLevel).toHaveBeenCalledWith("high", { persist: true });
    expect(a.abort).toHaveBeenCalled();
    expect(b.prompt).not.toHaveBeenCalled();
    await request({ id: 6, type: "prompt", text: "x", session: "gone" });
    expect(responses().at(-1)).toMatchObject({
      ok: false,
      error: "That conversation isn't open.",
    });
  });

  it("hands back a message Stop caught while it was routed, never sending it", async () => {
    const session = fakeSession();
    const completeSimple = vi.fn(
      (_m: unknown, _c: unknown, o: { signal: AbortSignal }) =>
        new Promise((resolve) =>
          o.signal.addEventListener("abort", () =>
            resolve({ stopReason: "aborted", content: [] }),
          ),
        ),
    );
    Object.assign(session.modelRuntime, {
      getModels: () => MODELS.map((m) => ({ ...m, cost: { output: 1 } })),
      completeSimple,
    });
    const { request, responses } = setup(
      fakeRuntime().runtime,
      async () => session,
    );
    await request({ id: 1, type: "new_session", cwd: "/work" });
    const sent = request({ id: 2, type: "prompt", text: "Add it" });
    await vi.waitFor(() => expect(completeSimple).toHaveBeenCalled());
    await request({ id: 3, type: "abort" });
    await sent;
    expect(session.prompt).not.toHaveBeenCalled();
    expect(responses().find((r) => r.id === 3)).toMatchObject({
      data: [{ text: "Add it" }],
    });
  });

  it("reopens a conversation mid-routing with its message, and closing it drops the message", async () => {
    const session = fakeSession();
    const completeSimple = vi.fn(
      (_m: unknown, _c: unknown, o: { signal: AbortSignal }) =>
        new Promise((resolve) =>
          o.signal.addEventListener("abort", () =>
            resolve({ stopReason: "aborted", content: [] }),
          ),
        ),
    );
    Object.assign(session.modelRuntime, {
      getModels: () => MODELS.map((m) => ({ ...m, cost: { output: 1 } })),
      completeSimple,
    });
    const { request, responses } = setup(
      fakeRuntime().runtime,
      async () => session,
    );
    await request({ id: 1, type: "new_session", cwd: "/work" });
    const sent = request({ id: 2, type: "prompt", text: "Add it" });
    await vi.waitFor(() => expect(completeSimple).toHaveBeenCalled());
    const id = (responses()[0] as { data: { session: string } }).data.session;
    await request({ id: 3, type: "open_session", cwd: "/work", session: id });
    expect(responses().find((r) => r.id === 3)).toMatchObject({
      data: { running: true, routing: { role: "user", content: "Add it" } },
    });
    await request({ id: 4, type: "close_session", cwd: "/work", session: id });
    await sent;
    expect(session.prompt).not.toHaveBeenCalled();
  });

  it("tells what a saved conversation did, with what's known beyond its file", async () => {
    const { request, responses } = setup(fakeRuntime().runtime);
    await request({
      id: 1,
      type: "session_details",
      cwd: "/work",
      session: "s",
    });
    expect(responses()[0]).toMatchObject({
      ok: true,
      data: { files: [], toolCalls: 0, branch: "feat/x" },
    });
  });

  it("shows a folder with no open conversation without starting one", async () => {
    const openSession = vi.fn<OpenSession>(async () => fakeSession());
    const { request, responses } = setup(fakeRuntime().runtime, openSession);
    await request({ id: 1, type: "open_session", cwd: "/work" });
    expect(responses()[0]).toMatchObject({ ok: true, data: null });
    expect(openSession).not.toHaveBeenCalled();
    await request({ id: 2, type: "session_state" });
    expect(responses()[1]).toMatchObject({
      ok: false,
      error: "No folder is open.",
    });
  });

  it("closes one conversation, or all of a folder's", async () => {
    const [a, b, c] = [fakeSession(), fakeSession(), fakeSession()];
    const sessions = [a, b, c];
    const { request, sent } = setup(fakeRuntime().runtime, async () =>
      sessions.shift()!,
    );
    await request({
      id: 1,
      type: "open_session",
      cwd: "/work",
      session: "/work:saved",
    });
    await request({ id: 2, type: "new_session", cwd: "/work" });
    await request({
      id: 3,
      type: "open_session",
      cwd: "/other",
      session: "/other:saved",
    });
    await request({
      id: 4,
      type: "close_session",
      cwd: "/work",
      session: "new1",
    });
    expect(b.dispose).toHaveBeenCalled();
    expect(a.dispose).not.toHaveBeenCalled();
    await request({ id: 5, type: "close_session", cwd: "/work" });
    expect(a.dispose).toHaveBeenCalled();
    expect(c.dispose).not.toHaveBeenCalled();
    expect(await waitFor(sent, "agents")).toMatchObject({
      agents: [{ cwd: "/other" }],
    });
  });

  it("searches folders' conversations and files for the command center", async () => {
    const saved = [
      {
        id: "s1",
        title: "check the sentry errors",
        modified: 2,
        messageCount: 4,
        text: "",
      },
    ];
    const files = vi.fn(async () => ["src/sentry.ts", "README.md"]);
    const sessions = fakeSessions(saved);
    const { request, responses } = setup(
      fakeRuntime().runtime,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      sessions,
      undefined,
      undefined,
      createSearch(sessions, files),
    );
    await request({
      id: 1,
      type: "command_search",
      text: "sentry",
      folders: ["/work"],
      kinds: ["conversation", "file"],
      limit: 10,
    });
    const out = responses()[0];
    expect(out).toMatchObject({
      ok: true,
      data: {
        conversations: [{ folder: "/work", id: "s1" }],
        files: [{ folder: "/work", path: "src/sentry.ts" }],
      },
    });
  });

  it("switches model through pi, keeping it for the next session", async () => {
    const session = fakeSession();
    const { request, responses } = setup(
      fakeRuntime().runtime,
      async () => session,
    );
    await request({
      id: 1,
      type: "open_session",
      cwd: "/work",
      session: "/work:saved",
    });
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
    await request({
      id: 1,
      type: "open_session",
      cwd: "/work",
      session: "/work:saved",
    });
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
    await request({
      id: 1,
      type: "open_session",
      cwd: "/work",
      session: "/work:saved",
    });
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
    await request({
      id: 1,
      type: "open_session",
      cwd: "/work",
      session: "/work:saved",
    });
    await request({ id: 2, type: "session_state" });
    expect(responses()[1]).toMatchObject({ ok: true, data: { model: opus } });
  });

  it("forwards the session's events in pi's wire form", async () => {
    const session = fakeSession();
    const { request, sent } = setup(fakeRuntime().runtime, async () => session);
    await request({
      id: 1,
      type: "open_session",
      cwd: "/work",
      session: "/work:saved",
    });
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
      {
        type: "session_event",
        session: "/work:saved",
        event: { type: "agent_start" },
      },
      {
        type: "session_event",
        session: "/work:saved",
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

  it("applies an MCP change to every open folder", async () => {
    const [a, b] = [fakeSession(), fakeSession()];
    const sessions = [a, b];
    const { request } = setup(fakeRuntime().runtime, async () =>
      sessions.shift()!,
    );
    await request({
      id: 1,
      type: "open_session",
      cwd: "/a",
      session: "/a:saved",
    });
    await request({
      id: 2,
      type: "open_session",
      cwd: "/b",
      session: "/b:saved",
    });
    a.isStreaming = true;
    await request({
      id: 3,
      type: "mcp_set_enabled",
      name: "x",
      enabled: false,
    });
    expect(b.reload).toHaveBeenCalledOnce();
    expect(a.reload).not.toHaveBeenCalled();
    a.emit({ type: "agent_settled" });
    expect(a.reload).toHaveBeenCalledOnce();
  });

  it("doesn't forward a hidden folder's events", async () => {
    const first = fakeSession();
    const sessions = [first, fakeSession()];
    const { request, sent } = setup(fakeRuntime().runtime, async () =>
      sessions.shift()!,
    );
    await request({
      id: 1,
      type: "open_session",
      cwd: "/a",
      session: "/a:saved",
    });
    await request({
      id: 2,
      type: "open_session",
      cwd: "/b",
      session: "/b:saved",
    });
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
    await request({
      id: 1,
      type: "open_session",
      cwd: "/work",
      session: "/work:saved",
    });
    await request({ id: 2, type: "prompt", text: "Fix it" });
    expect(session.prompt).toHaveBeenCalledWith("Fix it", {});
    expect(responses()[1]).toEqual({ type: "response", id: 2, ok: true });
  });

  it("steers the run with a prompt sent while it works", async () => {
    const session = fakeSession();
    session.isStreaming = true;
    const { request } = setup(fakeRuntime().runtime, async () => session);
    await request({
      id: 1,
      type: "open_session",
      cwd: "/work",
      session: "/work:saved",
    });
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
    await request({
      id: 1,
      type: "open_session",
      cwd: "/work",
      session: "/work:saved",
    });
    await request({ id: 2, type: "prompt", text: "What's this?", images });
    expect(session.prompt).toHaveBeenCalledWith("What's this?", { images });
  });

  it("reports a run pi couldn't carry out", async () => {
    const session = fakeSession();
    session.prompt.mockRejectedValue(new Error("No model selected."));
    const { request, sent } = setup(fakeRuntime().runtime, async () => session);
    await request({
      id: 1,
      type: "open_session",
      cwd: "/work",
      session: "/work:saved",
    });
    await request({ id: 2, type: "prompt", text: "Hi" });
    expect(await waitFor(sent, "session_error")).toEqual({
      type: "session_error",
      session: "/work:saved",
      error: "No model selected.",
    });
  });

  it("compacts the conversation, leaving failures to its compaction events", async () => {
    const session = fakeSession();
    const { request, responses } = setup(
      fakeRuntime().runtime,
      async () => session,
    );
    await request({
      id: 1,
      type: "open_session",
      cwd: "/work",
      session: "/work:saved",
    });
    await request({ id: 2, type: "compact", instructions: "Keep the API" });
    expect(session.compact).toHaveBeenCalledWith("Keep the API");
    session.compact.mockRejectedValueOnce(new Error("Nothing to compact"));
    await request({ id: 3, type: "compact", instructions: "" });
    expect(session.compact).toHaveBeenLastCalledWith(undefined);
    expect(responses().slice(1)).toEqual([
      { type: "response", id: 2, ok: true },
      { type: "response", id: 3, ok: true },
    ]);
  });

  it("reports the summary's progress while compacting", async () => {
    const session = fakeSession();
    const { request, sent } = setup(fakeRuntime().runtime, async () => session);
    await request({
      id: 1,
      type: "open_session",
      cwd: "/work",
      session: "/work:saved",
    });
    session.agent.streamFunction = async function* () {
      yield { type: "text_delta", delta: "x".repeat(40) };
    } as StreamFn;
    session.compact.mockImplementationOnce(async () => {
      await (session.agent.streamFunction as () => unknown)();
      await new Promise((r) => setTimeout(r, 0));
      return {};
    });
    await request({ id: 2, type: "compact" });
    expect(sent).toContainEqual({
      type: "session_event",
      session: "/work:saved",
      event: { type: "compaction_progress", tokens: 10 },
    });
  });

  it("refuses to compact mid-run, and compacts without progress when credentials don't resolve", async () => {
    const session = fakeSession();
    const { request, responses, sent } = setup(
      fakeRuntime().runtime,
      async () => session,
    );
    await request({
      id: 1,
      type: "open_session",
      cwd: "/work",
      session: "/work:saved",
    });
    session.isStreaming = true;
    await request({ id: 2, type: "compact" });
    expect(session.compact).not.toHaveBeenCalled();
    expect(responses()[1]).toMatchObject({ id: 2, ok: false });

    session.isStreaming = false;
    session.modelRuntime.getAuth.mockResolvedValueOnce(undefined);
    const streamFunction = session.agent.streamFunction;
    session.compact.mockImplementationOnce(async () => {
      // pi checks its own stream function to pick its strict credentials check.
      expect(session.agent.streamFunction).toBe(streamFunction);
      return {};
    });
    await request({ id: 3, type: "compact" });
    expect(session.compact).toHaveBeenCalledTimes(1);
    expect(responses()[2]).toEqual({ type: "response", id: 3, ok: true });
    expect(sent.some((m) => m.type === "session_event")).toBe(false);
  });

  it("aborts the run", async () => {
    const session = fakeSession();
    const { request, responses } = setup(
      fakeRuntime().runtime,
      async () => session,
    );
    await request({
      id: 1,
      type: "open_session",
      cwd: "/work",
      session: "/work:saved",
    });
    await request({ id: 2, type: "abort" });
    expect(session.abort).toHaveBeenCalled();
    expect(responses()[1]).toEqual({
      type: "response",
      id: 2,
      ok: true,
      data: [],
    });
  });

  describe("queued messages", () => {
    const image = {
      type: "image" as const,
      data: "AA==",
      mimeType: "image/png",
    };

    async function working() {
      const session = fakeSession();
      session.isStreaming = true;
      const host = setup(fakeRuntime().runtime, async () => session);
      await host.request({
        id: 1,
        type: "open_session",
        cwd: "/work",
        session: "/work:saved",
      });
      await host.request({ id: 2, type: "prompt", text: "a" });
      await host.request({
        id: 3,
        type: "prompt",
        text: "b",
        images: [image],
        queue: "followUp",
      });
      await host.request({
        id: 4,
        type: "prompt",
        text: "c",
        queue: "followUp",
      });
      return { session, ...host, data: (i: number) => host.responses()[i] };
    }

    it("waits for the run's end when asked to", async () => {
      const { session } = await working();
      expect(session.prompt).toHaveBeenCalledWith("b", {
        streamingBehavior: "followUp",
        images: [image],
      });
      expect(session.queue).toEqual({ steering: ["a"], followUp: ["b", "c"] });
    });

    it("lists what's queued when a conversation is shown again", async () => {
      const { request, data } = await working();
      await request({
        id: 5,
        type: "open_session",
        cwd: "/work",
        session: "/work:saved",
      });
      expect(data(4)).toMatchObject({
        data: { queue: { steering: ["a"], followUp: ["b", "c"] } },
      });
    });

    it("takes the queue back, with its images, when stopped", async () => {
      const { request, session, data } = await working();
      await request({ id: 5, type: "abort" });
      expect(data(4)).toMatchObject({
        data: [{ text: "a" }, { text: "b", images: [image] }, { text: "c" }],
      });
      expect(session.queue).toEqual({ steering: [], followUp: [] });
    });

    it("takes one message back and keeps the rest queued in order", async () => {
      const { request, session, data } = await working();
      await request({ id: 5, type: "unqueue", kind: "followUp", text: "b" });
      expect(data(4)).toMatchObject({ data: { text: "b", images: [image] } });
      expect(session.queue).toEqual({ steering: ["a"], followUp: ["c"] });
      expect(session.abort).not.toHaveBeenCalled();
    });

    it("moves one up a place, each place keeping its kind", async () => {
      const { request, session } = await working();
      const up = (id: number, kind: "steer" | "followUp", text: string) =>
        request({ id, type: "unqueue", kind, text, action: "up" });
      await up(5, "followUp", "c");
      expect(session.queue).toEqual({ steering: ["a"], followUp: ["c", "b"] });
      await up(6, "followUp", "c");
      expect(session.queue).toEqual({ steering: ["c"], followUp: ["a", "b"] });
      await up(7, "steer", "c");
      expect(session.queue).toEqual({ steering: ["c"], followUp: ["a", "b"] });
      expect(session.abort).not.toHaveBeenCalled();
    });

    it("sends one now, stopping the run", async () => {
      const { request, session } = await working();
      await request({
        id: 5,
        type: "unqueue",
        kind: "steer",
        text: "a",
        action: "now",
      });
      expect(session.abort).toHaveBeenCalled();
      expect(session.prompt).toHaveBeenLastCalledWith("a", {});
      expect(session.queue).toEqual({ steering: [], followUp: ["b", "c"] });
    });

    it("answers null for a message already delivered", async () => {
      const { request, session, data } = await working();
      await request({ id: 5, type: "unqueue", kind: "steer", text: "gone" });
      expect(data(4)).toMatchObject({ data: null });
      expect(session.queue).toEqual({ steering: ["a"], followUp: ["b", "c"] });
    });

    it("keeps the rest queued, not run, once the run has ended", async () => {
      const { request, session } = await working();
      session.isStreaming = false;
      const prompts = session.prompt.mock.calls.length;
      await request({ id: 5, type: "unqueue", kind: "steer", text: "a" });
      expect(session.queue).toEqual({ steering: [], followUp: ["b", "c"] });
      expect(session.prompt).toHaveBeenCalledTimes(prompts);
    });

    it("keeps each message's own images, even with the same text", async () => {
      const { request, data } = await working();
      const other = { ...image, data: "BB==" };
      await request({ id: 5, type: "prompt", text: "", images: [image] });
      await request({ id: 6, type: "prompt", text: "", images: [other] });
      await request({ id: 7, type: "abort" });
      expect(data(6)).toMatchObject({
        data: [
          { text: "a" },
          { text: "" },
          { text: "" },
          { text: "b", images: [image] },
          { text: "c" },
        ],
      });
      const taken = (data(6) as { data: { images?: unknown }[] }).data;
      expect(taken[1].images).toEqual([image]);
      expect(taken[2].images).toEqual([other]);
    });

    it("forgets a delivered message's images", async () => {
      const { request, session, data } = await working();
      session.queue.followUp.shift();
      session.emit({
        type: "message_start",
        message: {
          role: "user",
          content: [{ type: "text", text: "b" }, image],
          timestamp: 1,
        },
      } as SessionEvent);
      await request({ id: 5, type: "prompt", text: "b", queue: "followUp" });
      await request({ id: 6, type: "abort" });
      expect(data(5)).toMatchObject({
        data: [{ text: "a" }, { text: "c" }, { text: "b" }],
      });
      expect(
        (data(5) as { data: { images?: unknown }[] }).data[2].images,
      ).toBeUndefined();
    });
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
    await request({
      id: 1,
      type: "open_session",
      cwd: "/work",
      session: "/work:saved",
    });
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
    await request({
      id: 1,
      type: "open_session",
      cwd: "/work",
      session: "/work:saved",
    });
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
    await request({
      id: 1,
      type: "open_session",
      cwd: "/work",
      session: "/work:saved",
    });
    session.isStreaming = true;
    await request({ id: 2, type: "set_trust", cwd: "/work", trusted: true });
    expect(session.reload).not.toHaveBeenCalled();
    session.emit({ type: "agent_settled" } as SessionEvent);
    expect(session.reload).toHaveBeenCalledOnce();
  });

  it("saves a refusal without reloading", async () => {
    const { request, trust, session } = trusting();
    await request({
      id: 1,
      type: "open_session",
      cwd: "/work",
      session: "/work:saved",
    });
    await request({ id: 2, type: "set_trust", cwd: "/work", trusted: false });
    expect(trust.set).toHaveBeenCalledWith("/work", false);
    expect(session.settingsManager.setProjectTrusted).not.toHaveBeenCalled();
    expect(session.reload).not.toHaveBeenCalled();
  });

  it("only saves trust for a folder that isn't open", async () => {
    const { request, trust, session } = trusting();
    await request({ id: 1, type: "set_trust", cwd: "/other", trusted: true });
    await request({
      id: 2,
      type: "open_session",
      cwd: "/work",
      session: "/work:saved",
    });
    await request({ id: 3, type: "set_trust", cwd: "/other", trusted: true });
    expect(trust.set).toHaveBeenCalledTimes(2);
    expect(session.reload).not.toHaveBeenCalled();
  });
});

describe("workspaces", () => {
  /** A host whose agents work in /wt/<id>. */
  const withWorktrees = (
    openSession: OpenSession = async () => fakeSession(),
  ) => {
    const workspaces = {
      ...fakeWorkspaces(),
      open: vi.fn(async (_folder: string, id: string) => ({
        dir: `/wt/${id}`,
        ready: Promise.resolve(),
      })),
    };
    const host = setup(
      fakeRuntime().runtime,
      openSession,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      workspaces,
    );
    return { ...host, workspaces };
  };

  it("runs each agent in its own workspace", async () => {
    const openSession = vi.fn<OpenSession>(async () => fakeSession());
    const { request, responses } = withWorktrees(openSession);
    await request({
      id: 1,
      type: "open_session",
      cwd: "/work",
      session: "/work:saved",
    });
    await request({ id: 2, type: "new_session", cwd: "/work" });
    expect(openSession.mock.calls.map((c) => c.slice(0, 3))).toEqual([
      ["/work", "/wt//work:saved", "/work:saved"],
      ["/work", "/wt/new1", "new1"],
    ]);
    expect(responses()[1]).toMatchObject({ data: { workdir: "/wt/new1" } });
  });

  it("closes an agent's workspace after its session, on close and quit", async () => {
    const session = fakeSession();
    const { request, workspaces, host } = withWorktrees(async () => session);
    await request({
      id: 1,
      type: "open_session",
      cwd: "/work",
      session: "/work:saved",
    });
    const order: string[] = [];
    session.dispose.mockImplementation(() => order.push("dispose"));
    workspaces.close.mockImplementation(async () => void order.push("close"));
    await request({
      id: 2,
      type: "close_session",
      cwd: "/work",
      session: "/work:saved",
    });
    expect(workspaces.close).toHaveBeenCalledWith("/work", "/work:saved");
    expect(order).toEqual(["dispose", "close"]);
    await request({ id: 3, type: "new_session", cwd: "/work" });
    await request({ id: 5, type: "close_session", cwd: "/work" });
    expect(workspaces.close).toHaveBeenLastCalledWith("/work", "new1");
    await request({ id: 4, type: "new_session", cwd: "/other" });
    await host.shutdown();
    expect(workspaces.close).toHaveBeenLastCalledWith("/other", "new2");
  });

  it("removes the workspace of a session that failed to open", async () => {
    const { request, responses, workspaces } = withWorktrees(async () => {
      throw new Error("No model.");
    });
    await request({
      id: 1,
      type: "open_session",
      cwd: "/work",
      session: "/work:saved",
    });
    expect(responses()[0]).toMatchObject({ ok: false, error: "No model." });
    expect(workspaces.close).toHaveBeenCalledWith("/work", "/work:saved");
  });

  it("holds the first prompt until the workspace has its dependencies", async () => {
    const session = fakeSession();
    let settle = () => {};
    const { request, workspaces } = withWorktrees(async () => session);
    workspaces.open.mockImplementation(async () => ({
      dir: "/wt/a",
      ready: new Promise<void>((resolve) => (settle = resolve)),
    }));
    await request({
      id: 1,
      type: "open_session",
      cwd: "/work",
      session: "/work:saved",
    });
    const sending = request({ id: 2, type: "prompt", text: "hi" });
    await Promise.resolve();
    expect(session.prompt).not.toHaveBeenCalled();
    settle();
    await sending;
    expect(session.prompt).toHaveBeenCalled();
  });
});

describe("tool approval", () => {
  type Ask = Parameters<Parameters<OpenSession>[4]>[0];
  /** Opens a session and returns a way to ask as the extension does. */
  const opened = async () => {
    let onApproval: (ask: Ask) => void = () => {};
    const session = fakeSession();
    const host = setup(
      fakeRuntime().runtime,
      async (_cwd, _workdir, _id, _status, ask) => {
        onApproval = ask;
        return session;
      },
    );
    await host.request({
      id: 1,
      type: "open_session",
      cwd: "/work",
      session: "/work:saved",
    });
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
      session: "/work:saved",
      request: { toolCallId: "t1", reason: "Pipes text into a shell" },
    });
    await request({
      type: "approval_answer",
      toolCallId: "t1",
      approved: true,
    });
    expect(answer).toHaveBeenCalledWith(true, undefined, undefined);
    // Answered once; a second answer finds nothing waiting.
    await request({
      type: "approval_answer",
      toolCallId: "t1",
      approved: false,
    });
    expect(answer).toHaveBeenCalledOnce();
  });

  it("passes ask_user's answers back with the reply", async () => {
    const { ask, request } = await opened();
    const answer = ask("t1");
    const answers = [
      { question: "Where?", choices: [{ answer: "SQLite", note: "x" }] },
    ];
    await request({
      type: "approval_answer",
      toolCallId: "t1",
      approved: true,
      answers,
    });
    expect(answer).toHaveBeenCalledWith(true, answers, undefined);
  });

  it("passes on that the user always allows what was blocked", async () => {
    const { ask, request } = await opened();
    const answer = ask("t1");
    await request({
      type: "approval_answer",
      toolCallId: "t1",
      approved: true,
      always: true,
    });
    expect(answer).toHaveBeenCalledWith(true, undefined, true);
  });

  it("tells a call the user declined it, but not when the run is stopped", async () => {
    const { request, reopen } = await opened();
    const declined = vi.fn();
    const answer = vi.fn();
    reopen()({ request: { toolCallId: "t1" }, answer, declined });
    reopen()({ request: { toolCallId: "t2" }, answer, declined });
    await request({
      type: "approval_answer",
      toolCallId: "t1",
      approved: false,
    });
    expect(declined).toHaveBeenCalledOnce();
    await request({ id: 2, type: "abort" });
    expect(answer).toHaveBeenCalledTimes(2);
    expect(declined).toHaveBeenCalledOnce();
  });

  it("denies waiting calls when the run is stopped", async () => {
    const { ask, request, session } = await opened();
    const answer = ask("t1");
    await request({ id: 2, type: "abort" });
    expect(answer).toHaveBeenCalledWith(false);
    expect(session.abort).toHaveBeenCalled();
  });

  it("denies waiting calls when the user writes instead, then sends the message", async () => {
    const { ask, request, session } = await opened();
    const first = ask("t1");
    const second = ask("t2");
    await request({ id: 2, type: "prompt", text: "Do it another way" });
    expect(first).toHaveBeenCalledWith(false);
    expect(second).toHaveBeenCalledWith(false);
    expect(session.prompt).toHaveBeenCalledWith(
      "Do it another way",
      expect.anything(),
    );
  });

  it("keeps a hidden folder's question until it's shown again", async () => {
    const { reopen, request, sent, responses } = await opened();
    const askWork = reopen();
    await request({
      id: 2,
      type: "open_session",
      cwd: "/other",
      session: "/other:saved",
    });
    sent.splice(0);
    const answer = vi.fn();
    askWork({ request: { toolCallId: "t1", reason: "Deletes files" }, answer });
    expect(sent).not.toContainEqual(
      expect.objectContaining({ type: "approval_request" }),
    );
    expect(sent).toContainEqual({
      type: "agents",
      agents: [
        {
          cwd: "/work",
          session: "/work:saved",
          title: "",
          running: false,
          waiting: true,
        },
        {
          cwd: "/other",
          session: "/other:saved",
          title: "",
          running: false,
          waiting: false,
        },
      ],
    });
    await request({
      id: 3,
      type: "open_session",
      cwd: "/work",
      session: "/work:saved",
    });
    expect(responses().at(-1)).toMatchObject({
      data: { approvals: [{ toolCallId: "t1", reason: "Deletes files" }] },
    });
    expect(answer).not.toHaveBeenCalled();
  });

  it("denies waiting calls when their folder closes", async () => {
    const { ask, request } = await opened();
    const answer = ask("t1");
    await request({ id: 2, type: "close_session", cwd: "/work" });
    expect(answer).toHaveBeenCalledWith(false);
  });

  it("denies a question from a session that was closed", async () => {
    const { reopen, request, sent } = await opened();
    const stale = reopen();
    await request({ id: 2, type: "close_session", cwd: "/work" });
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
    const openSession: OpenSession = async (
      _cwd,
      _workdir,
      _id,
      onMcpStatus,
    ) => {
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
    await ctx.request({
      id: 1,
      type: "open_session",
      cwd: "/work",
      session: "/work:saved",
    });
    await settle();
    ctx.sent.splice(0);
    const status = (s: McpStatusSnapshot) => listeners[0](s);
    return { ...ctx, session, store, status };
  }

  const settle = () => new Promise((r) => setTimeout(r));

  /** A host with no folder open; `mcpStatus` sends the MCP session's status. */
  function withoutFolder(servers: SavedServer[] = [docs]) {
    const store = fakeMcpStore(servers);
    const ctx = setup(
      fakeRuntime().runtime,
      undefined,
      undefined,
      undefined,
      store,
    );
    return { ...ctx, store };
  }

  it("lists servers with a status while no folder is open, opening nothing", async () => {
    const { request, responses, openMcpSession } = withoutFolder();
    await request({ id: 1, type: "mcp_list" });
    expect(responses()[0]).toEqual({
      type: "response",
      id: 1,
      ok: true,
      data: [{ ...docs, status: "idle" }],
    });
    expect(openMcpSession).not.toHaveBeenCalled();
  });

  it("shows the MCP session's status unless the shown folder knows more", async () => {
    const { request, responses, mcpStatus, status } = await withSession([
      docs,
      { ...docs, name: "web" },
    ]);
    await request({ id: 2, type: "mcp_sign_in", name: "docs" });
    mcpStatus({
      servers: [
        { name: "docs", status: "needs-auth" },
        { name: "web", status: "connected" },
      ],
    });
    status({
      servers: [
        { name: "docs", status: "failed" },
        { name: "web", status: "not-connected" },
      ],
    });
    await request({ id: 3, type: "mcp_list" });
    expect(responses().at(-1)).toMatchObject({
      data: [
        { name: "docs", status: "failed" },
        { name: "web", status: "connected" },
      ],
    });
  });

  it("pushes the MCP session's status and remembers sign-ins from it", async () => {
    const { request, sent, mcpStatus, store } = withoutFolder();
    await request({ id: 1, type: "mcp_sign_in", name: "docs" });
    sent.splice(0);
    mcpStatus({ servers: [{ name: "docs", status: "needs-auth" }] });
    expect(await waitFor(sent, "mcp_servers")).toEqual({
      type: "mcp_servers",
      servers: [{ ...docs, status: "needs-auth" }],
    });
    expect(store.signIns).toEqual(["docs"]);
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
      await request({
        id: 1,
        type: "open_session",
        cwd: "/work",
        session: "/work:saved",
      });
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
    await request({
      id: 1,
      type: "open_session",
      cwd: "/work",
      session: "/work:saved",
    });
    expect(await waitFor(sent, "mcp_servers")).toMatchObject({
      servers: [{ status: "idle" }, { status: "disabled" }],
    });
  });

  it("keeps status the adapter reports while the session is opening", async () => {
    const openSession: OpenSession = async (
      _cwd,
      _workdir,
      _id,
      onMcpStatus,
    ) => {
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
    await request({
      id: 1,
      type: "open_session",
      cwd: "/work",
      session: "/work:saved",
    });
    await settle();
    expect(sent.filter((m) => m.type === "mcp_servers")).toEqual([
      { type: "mcp_servers", servers: [{ ...docs, status: "connected" }] },
    ]);
  });

  it("doesn't push a hidden folder's status", async () => {
    const { request, sent, status } = await withSession();
    await request({
      id: 2,
      type: "open_session",
      cwd: "/other",
      session: "/other:saved",
    });
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

    it("connects a saved URL server once in the MCP session, with no folder open", async () => {
      const { request, responses, mcp, sent } = withoutFolder([]);
      let finish = () => {};
      mcp.prompt.mockReturnValue(new Promise<void>((r) => (finish = r)));
      await request({ id: 1, type: "mcp_save", name: "web", config: web });
      await vi.waitFor(() => expect(checks(mcp)).toHaveLength(1));
      expect(statusOf(responses()[0], "web")).toBe("checking");

      sent.splice(0);
      finish();
      const pushed = (await waitFor(sent, "mcp_servers")) as {
        servers: { name: string; status: string }[];
      };
      expect(pushed.servers.find((m) => m.name === "web")?.status).toBe("idle");
    });

    it("checks while a conversation runs, reloading the MCP session first", async () => {
      const { request, session, mcp } = await withSession();
      session.isStreaming = true;
      await request({ id: 2, type: "mcp_save", name: "web", config: web });
      await vi.waitFor(() => expect(checks(mcp)).toHaveLength(1));
      await request({ id: 3, type: "mcp_save", name: "web", config: web });
      expect(mcp.reload).toHaveBeenCalledTimes(1);
      expect(session.prompt).not.toHaveBeenCalled();
    });

    it("leaves local command servers and servers that are off alone", async () => {
      const { request, mcp, store } = withoutFolder([]);
      await request({ id: 1, type: "mcp_save", name: "cli", config: stdio });
      store.save.mockImplementationOnce(async () => {
        store.servers = [{ ...docs, name: "web", enabled: false, config: web }];
      });
      await request({ id: 2, type: "mcp_save", name: "web", config: web });
      await settle();
      expect(mcp.prompt).not.toHaveBeenCalled();
    });

    it("skips the check without the adapter, and ignores a failed one", async () => {
      const { request, mcp, responses, sent } = withoutFolder([]);
      mcp.prompt.mockRejectedValue(new Error("offline"));
      await request({ id: 1, type: "mcp_save", name: "web", config: web });
      await vi.waitFor(() => expect(checks(mcp)).toHaveLength(1));

      mcp.prompt.mockClear();
      mcp.extensionRunner.getCommand.mockReturnValue(undefined);
      sent.splice(0);
      await request({ id: 2, type: "mcp_save", name: "web", config: web });
      await waitFor(sent, "mcp_servers");
      expect(mcp.prompt).not.toHaveBeenCalled();
      expect(statusOf(responses().at(-1)!, "web")).toBe("checking");
    });

    it("tries opening the MCP session again after it failed", async () => {
      const { request, mcp, openMcpSession } = withoutFolder([]);
      openMcpSession.mockRejectedValueOnce(new Error("pi broke"));
      await request({ id: 1, type: "mcp_save", name: "web", config: web });
      await settle();
      await request({ id: 2, type: "mcp_save", name: "web", config: web });
      await vi.waitFor(() => expect(checks(mcp)).toHaveLength(1));
      expect(openMcpSession).toHaveBeenCalledTimes(2);
    });
  });

  describe("removing a server", () => {
    const signOuts = (session: ReturnType<typeof fakeSession>) =>
      session.prompt.mock.calls.filter(
        ([text]: unknown[]) => text === "/app-mcp-sign-out docs",
      );

    it("deletes its saved sign-in first, with no folder open", async () => {
      const { request, mcp, store } = withoutFolder();
      await request({ id: 1, type: "mcp_remove", name: "docs" });
      expect(signOuts(mcp)).toHaveLength(1);
      expect(store.remove).toHaveBeenCalledWith("docs");
    });

    it("removes it even when the sign-out fails", async () => {
      const { request, mcp, store, responses } = withoutFolder();
      mcp.prompt.mockRejectedValue(new Error("keychain"));
      await request({ id: 1, type: "mcp_remove", name: "docs" });
      expect(store.remove).toHaveBeenCalledWith("docs");
      expect(responses()[0]).toMatchObject({ ok: true });
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
      session: "/work:saved",
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

  it("signs in in the MCP session with no folder open, then connects", async () => {
    const { request, responses, mcp } = withoutFolder();
    await request({ id: 1, type: "mcp_sign_in", name: "docs" });
    expect(mcp.prompt).toHaveBeenNthCalledWith(1, "/app-mcp-sign-in docs", {});
    expect(mcp.prompt).toHaveBeenNthCalledWith(2, "/mcp reconnect docs", {});
    expect(responses()[0]).toMatchObject({ ok: true });
  });

  it("connects a signed-in server in idle conversations with the adapter", async () => {
    const { request, session } = await withSession();
    await request({ id: 2, type: "mcp_sign_in", name: "docs" });
    expect(session.prompt).toHaveBeenCalledWith("/mcp reconnect docs", {});

    session.prompt.mockClear();
    session.isStreaming = true;
    await request({ id: 3, type: "mcp_sign_in", name: "docs" });
    session.isStreaming = false;
    session.extensionRunner.getCommand.mockReturnValue(undefined);
    await request({ id: 4, type: "mcp_sign_in", name: "docs" });
    expect(session.prompt).not.toHaveBeenCalled();
  });

  it("can't sign in without the adapter's sign-in command", async () => {
    const { request, responses, mcp } = withoutFolder();
    mcp.extensionRunner.getCommand.mockImplementation(
      (name: string) => name === "mcp" || undefined,
    );
    await request({ id: 1, type: "mcp_sign_in", name: "docs" });
    expect(responses()[0]).toMatchObject({
      ok: false,
      error: "MCP sign-in isn't available.",
    });
    expect(mcp.prompt).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", "There is no server named missing."],
    ["off", "Turn off on first."],
  ])("won't sign in to %s", async (name, error) => {
    const { request, responses, mcp } = withoutFolder([docs, off]);
    await request({ id: 1, type: "mcp_sign_in", name });
    expect(responses()[0]).toMatchObject({ ok: false, error });
    expect(mcp.prompt).not.toHaveBeenCalled();
  });

  it("won't send the command to the model when the adapter isn't loaded", async () => {
    const { request, responses, mcp } = withoutFolder();
    mcp.extensionRunner.getCommand.mockReturnValue(undefined);
    await request({ id: 1, type: "mcp_sign_in", name: "docs" });
    expect(responses()[0]).toMatchObject({
      ok: false,
      error: "MCP isn't running. Check mcp.json.",
    });
    expect(mcp.prompt).not.toHaveBeenCalled();
  });
});

describe("toWireEvent", () => {
  it("leaves events other than message_update alone", () => {
    const event = { type: "message_end", message: { role: "user" } };
    expect(toWireEvent(event as SessionEvent)).toBe(event);
  });

  it("names a starting tool call from pi's partial message, then drops it", () => {
    const partial = {
      content: [{ type: "toolCall", id: "c1", name: "bash", arguments: {} }],
    };
    const event = {
      type: "message_update",
      message: partial,
      assistantMessageEvent: {
        type: "toolcall_start",
        contentIndex: 0,
        partial,
      },
    };
    expect(toWireEvent(event as unknown as SessionEvent)).toEqual({
      type: "message_update",
      assistantMessageEvent: {
        type: "toolcall_start",
        contentIndex: 0,
        id: "c1",
        toolName: "bash",
      },
    });
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

  it("copies Claude Code's sign-ins for imported URL servers, with no folder open", async () => {
    const { request, mcp } = withCatalog();
    await request({
      id: 1,
      type: "mcp_import",
      source: "claude-code",
      names: ["my docs", "blender"],
    });
    const copies = mcp.prompt.mock.calls
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

describe("skills", () => {
  const LIST = [
    { id: "skills/a", name: "a", description: "A.", enabled: true },
  ];

  async function withSkills() {
    const session = fakeSession();
    const skills = {
      list: vi.fn(async () => LIST),
      setEnabled: vi.fn(async () => {}),
      remove: vi.fn(async () => {}),
      importSkills: vi.fn(async () => {}),
      catalog: vi.fn(async () => ({ sources: [] })),
    } as unknown as SkillStore;
    const host = setup(
      fakeRuntime().runtime,
      async () => session,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      skills,
    );
    await host.request({
      id: 1,
      type: "open_session",
      cwd: "/w",
      session: "s",
    });
    host.sent.length = 0;
    return { ...host, session, skills };
  }

  it("saves a change, reloads open sessions and answers with the list", async () => {
    const { request, responses, session, skills } = await withSkills();
    await request({
      id: 2,
      type: "skills_set_enabled",
      skill: "skills/a",
      enabled: false,
    });
    await request({ id: 3, type: "skills_remove", skill: "skills/a" });
    await request({
      id: 4,
      type: "skills_import",
      source: "/src",
      names: ["a"],
    });
    expect(skills.setEnabled).toHaveBeenCalledWith("skills/a", false);
    expect(skills.remove).toHaveBeenCalledWith("skills/a");
    expect(skills.importSkills).toHaveBeenCalledWith("/src", ["a"]);
    expect(session.reload).toHaveBeenCalledTimes(3);
    expect(responses().map((r) => (r as { data: unknown }).data)).toEqual([
      LIST,
      LIST,
      LIST,
    ]);
  });

  it("lists skills and the catalog without reloading", async () => {
    const { request, responses, session } = await withSkills();
    await request({ id: 2, type: "skills_list" });
    await request({ id: 3, type: "skills_catalog" });
    expect(session.reload).not.toHaveBeenCalled();
    expect(responses()).toMatchObject([
      { ok: true, data: LIST },
      { ok: true, data: { sources: [] } },
    ]);
  });
});

describe("tasks", () => {
  const task = (over: Partial<Task> = {}): Task => ({
    id: "t1",
    title: "Fix it",
    notes: "",
    images: [],
    subtasks: [],
    created: 1,
    updated: 1,
    ...over,
  });
  const withTasks = () => setup(fakeRuntime().runtime);
  const data = (r: unknown) => (r as { data: unknown }).data;

  it("lists, saves and deletes a folder's tasks", async () => {
    const { request, responses } = withTasks();
    await request({ id: 1, type: "tasks_list", cwd: "/work" });
    await request({ id: 2, type: "task_save", cwd: "/work", task: task() });
    await request({ id: 3, type: "tasks_list", cwd: "/work" });
    await request({ id: 4, type: "task_delete", cwd: "/work", taskId: "t1" });
    expect(responses().map(data)).toEqual([[], [task()], [task()], []]);
  });

  it("starts a task in a new conversation and sends it the task", async () => {
    const session = fakeSession();
    const { tasks, request, responses } = setup(
      fakeRuntime().runtime,
      async () => session,
    );
    const image = {
      type: "image" as const,
      data: "abc",
      mimeType: "image/png",
    };
    await tasks.save(
      "/work",
      task({ notes: "Soon", images: [{ ...image, name: "a.png" }] }),
    );
    await request({ id: 1, type: "task_start", cwd: "/work", taskId: "t1" });
    const [started] = (await tasks.list("/work")) as Task[];
    expect(started.session).toBe("new1");
    expect(data(responses()[0])).toEqual([started]);
    expect(session.prompt).toHaveBeenCalledWith(
      "Fix it\n\nSoon\n\nAttached images: a.png",
      { images: [image] },
    );
  });

  it("runs a task on its model and effort without saving them as defaults", async () => {
    const session = fakeSession();
    const { tasks, request } = setup(
      fakeRuntime().runtime,
      async () => session,
    );
    await tasks.save(
      "/work",
      task({ model: { provider: OPUS.provider, id: OPUS.id }, effort: "high" }),
    );
    await request({ id: 1, type: "task_start", cwd: "/work", taskId: "t1" });
    expect(session.setModel).toHaveBeenCalledWith(OPUS, { persist: false });
    expect(session.setThinkingLevel).toHaveBeenCalledWith("high", {
      persist: false,
    });
  });

  it("keeps the default model when the task's is gone", async () => {
    const session = fakeSession();
    const { tasks, request } = setup(
      fakeRuntime().runtime,
      async () => session,
    );
    await tasks.save("/work", task({ model: { provider: "x", id: "gone" } }));
    await request({ id: 1, type: "task_start", cwd: "/work", taskId: "t1" });
    expect(session.setModel).not.toHaveBeenCalled();
    expect(session.setThinkingLevel).not.toHaveBeenCalled();
  });
});

describe("task_edit and task_save", () => {
  const task = (over: Partial<Task> = {}): Task => ({
    id: "t1",
    title: "Fix it",
    notes: "",
    images: [],
    subtasks: [],
    created: 1,
    updated: 1,
    ...over,
  });

  it("edits the user's fields and keeps what the agent wrote since", async () => {
    const { tasks, request, responses } = setup(fakeRuntime().runtime);
    await tasks.save("/work", task());
    await tasks.change("/work", (all) =>
      all.map((t) => ({ ...t, step: "go", planned: true, session: "s1" })),
    );
    await request({
      id: 1,
      type: "task_edit",
      cwd: "/work",
      taskId: "t1",
      patch: { title: "New", session: "evil" } as never,
    });
    const [saved] = (responses().at(-1) as unknown as { data: Task[] }).data;
    expect(saved).toMatchObject({
      title: "New",
      step: "go",
      planned: true,
      session: "s1",
    });
    expect(await tasks.list("/work")).toEqual([saved]);
  });

  it("refuses to save over an existing task", async () => {
    const { request, sent } = setup(fakeRuntime().runtime);
    const save = () =>
      request({ id: 1, type: "task_save", cwd: "/work", task: task() });
    await save();
    await save();
    expect(sent.at(-1)).toMatchObject({
      type: "response",
      error: expect.stringContaining("That task already exists."),
    });
  });
});

describe("task start and delete", () => {
  const task = (over: Partial<Task> = {}): Task => ({
    id: "t1",
    title: "Fix it",
    notes: "",
    images: [],
    subtasks: [],
    created: 1,
    updated: 1,
    ...over,
  });
  const start = { type: "task_start", cwd: "/work", taskId: "t1" } as const;

  it("starts one conversation for two quick starts", async () => {
    const openSession = vi.fn(async () => fakeSession());
    const { tasks, request, sent } = setup(fakeRuntime().runtime, openSession);
    await tasks.save("/work", task());
    await Promise.all([
      request({ id: 1, ...start }),
      request({ id: 2, ...start }),
    ]);
    expect(openSession).toHaveBeenCalledTimes(1);
    expect(sent.filter((m) => m.type === "response" && !m.ok)).toHaveLength(1);
  });

  it("shows a failed start on the task, which becomes startable again", async () => {
    const { tasks, request } = setup(fakeRuntime().runtime, async () => {
      throw new Error("no model");
    });
    await tasks.save("/work", task());
    await request({ id: 1, ...start });
    const [t] = await tasks.list("/work");
    expect(t.session).toBeUndefined();
    expect(t.error).toContain("no model");
  });

  it("ends a running task's conversation when the task is deleted", async () => {
    const workspaces = fakeWorkspaces();
    const { tasks, request } = setup(
      fakeRuntime().runtime,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      workspaces,
    );
    await tasks.save("/work", task());
    await request({ id: 1, ...start });
    await request({ id: 2, type: "task_delete", cwd: "/work", taskId: "t1" });
    expect(workspaces.close).toHaveBeenCalledWith("/work", "new1");
    expect(await tasks.list("/work")).toEqual([]);
  });
});
