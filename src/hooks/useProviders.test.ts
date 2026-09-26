import { mockIPC } from "@tauri-apps/api/mocks";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HostMessage, ProviderStatus } from "../../shared/hostProtocol";
import type { HostClient } from "@/lib/piHost";
import { useProviders } from "./useProviders";

const DISCONNECTED: ProviderStatus[] = [
  { id: "anthropic", connected: false },
  { id: "openai-codex", connected: false },
  { id: "openai", connected: false },
];

/**
 * A fake sidecar client. Requests are recorded and answered with `respond`
 * (or left pending until `resolve`/`reject`), and `emit` pushes a message
 * to subscribers the way the sidecar would.
 */
function fakeClient(overrides: Partial<Record<string, unknown>> = {}) {
  // cancel_login always answers at once, like the real sidecar.
  const respond: Record<string, unknown> = {
    status: DISCONNECTED,
    cancel_login: undefined,
    ...overrides,
  };
  const listeners = new Set<(m: HostMessage) => void>();
  const pending: {
    type: string;
    resolve(v: unknown): void;
    reject(e: Error): void;
  }[] = [];
  const client: HostClient = {
    request: vi.fn(
      (req: { type: string }) =>
        new Promise((resolve, reject) => {
          if (req.type in respond) resolve(respond[req.type]);
          else pending.push({ type: req.type, resolve, reject });
        }),
    ) as HostClient["request"],
    send: vi.fn(async () => {}),
    subscribe: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    close: vi.fn(async () => {}),
  };
  return {
    client,
    emit: (m: HostMessage) => act(() => listeners.forEach((cb) => cb(m))),
    pendingOf: (type: string) => pending.find((p) => p.type === type)!,
  };
}

/** Records browser opens made through the opener plugin. */
let opened: string[];
beforeEach(() => {
  opened = [];
  mockIPC((cmd, args) => {
    if (cmd === "plugin:opener|open_url") {
      opened.push((args as { url: string }).url);
    }
    return null;
  });
});

async function setup(fake = fakeClient()) {
  const open = async () => fake.client;
  const hook = renderHook(() => useProviders(open));
  await waitFor(() => expect(hook.result.current.statuses).not.toBeNull());
  return { ...hook, ...fake };
}

describe("useProviders", () => {
  it("loads each provider's status from the sidecar", async () => {
    const { result } = await setup();
    expect(result.current.statuses).toEqual(DISCONNECTED);
    expect(result.current.anyConnected).toBe(false);
  });

  it("reports a sidecar that can't start", async () => {
    const { result } = renderHook(() =>
      useProviders(async () => {
        throw new Error("spawn node ENOENT");
      }),
    );
    await waitFor(() =>
      expect(result.current.hostError).toBe("spawn node ENOENT"),
    );
  });

  it("stops the sidecar on unmount", async () => {
    const { unmount, client } = await setup();
    unmount();
    expect(client.close).toHaveBeenCalled();
  });

  it("stops a sidecar that finishes starting after unmount", async () => {
    const fake = fakeClient();
    let finish: (c: HostClient) => void = () => {};
    const { unmount } = renderHook(() =>
      useProviders(() => new Promise((r) => (finish = r))),
    );
    unmount();
    await act(async () => finish(fake.client));
    expect(fake.client.close).toHaveBeenCalled();
  });

  describe("connect", () => {
    it("tracks the sign-in and updates the status when it succeeds", async () => {
      const fake = fakeClient();
      const { result, pendingOf } = await setup(fake);
      let done: Promise<boolean>;
      act(() => {
        done = result.current.connect("anthropic", "oauth");
      });
      expect(result.current.login).toEqual({
        provider: "anthropic",
        method: "oauth",
      });

      await act(async () =>
        pendingOf("login").resolve({
          id: "anthropic",
          connected: true,
          method: "oauth",
        }),
      );
      await expect(done!).resolves.toBe(true);
      expect(result.current.login).toBeNull();
      expect(result.current.statuses?.[0]).toEqual({
        id: "anthropic",
        connected: true,
        method: "oauth",
      });
      expect(result.current.anyConnected).toBe(true);
    });

    it("sends the API key with an api_key sign-in", async () => {
      const { result, client } = await setup(
        fakeClient({
          status: DISCONNECTED,
          login: { id: "openai", connected: true, method: "api_key" },
        }),
      );
      await act(() => result.current.connect("openai", "api_key", "sk-x"));
      expect(client.request).toHaveBeenCalledWith({
        type: "login",
        provider: "openai",
        method: "api_key",
        apiKey: "sk-x",
      });
    });

    it("opens the sign-in page in the browser", async () => {
      const { result, emit } = await setup();
      act(() => void result.current.connect("anthropic", "oauth"));
      emit({
        type: "auth_event",
        event: { type: "auth_url", url: "https://claude.ai/oauth/authorize" },
      });
      await waitFor(() =>
        expect(opened).toEqual(["https://claude.ai/oauth/authorize"]),
      );
    });

    it.each(["progress", "info"] as const)(
      "shows %s messages while signing in",
      async (type) => {
        const { result, emit } = await setup();
        act(() => void result.current.connect("anthropic", "oauth"));
        emit({ type: "auth_event", event: { type, message: "Exchanging…" } });
        expect(result.current.login?.progress).toBe("Exchanging…");
      },
    );

    it("ignores prompts, device codes and other messages", async () => {
      // Sign-in always runs in the browser, which needs none of them.
      const { result, emit } = await setup();
      act(() => void result.current.connect("openai-codex", "oauth"));
      emit({
        type: "auth_prompt",
        promptId: 1,
        prompt: { type: "manual_code", message: "Paste" },
      });
      emit({ type: "auth_prompt_closed", promptId: 1 });
      emit({
        type: "auth_event",
        event: {
          type: "device_code",
          userCode: "ABCD-1234",
          verificationUri: "https://auth.openai.com/codex/device",
        },
      });
      emit({ type: "ready" });
      expect(result.current.login).toEqual({
        provider: "openai-codex",
        method: "oauth",
      });
    });

    it("ignores progress when no sign-in is running", async () => {
      const { result, emit } = await setup();
      emit({
        type: "auth_event",
        event: { type: "progress", message: "stray" },
      });
      expect(result.current.login).toBeNull();
    });

    it("shows sign-in errors against the provider", async () => {
      const { result, pendingOf } = await setup();
      let done: Promise<boolean>;
      act(() => {
        done = result.current.connect("anthropic", "oauth");
      });
      await act(async () =>
        pendingOf("login").reject(new Error("Token exchange failed")),
      );
      await expect(done!).resolves.toBe(false);
      expect(result.current.error).toEqual({
        provider: "anthropic",
        message: "Token exchange failed",
      });
      expect(result.current.login).toBeNull();
    });

    it("treats a cancelled sign-in as no error", async () => {
      const { result, pendingOf, client } = await setup();
      act(() => void result.current.connect("anthropic", "oauth"));
      await act(() => result.current.cancel());
      expect(client.request).toHaveBeenCalledWith({ type: "cancel_login" });
      await act(async () =>
        pendingOf("login").reject(new Error("Sign-in cancelled.")),
      );
      expect(result.current.error).toBeNull();
      expect(result.current.login).toBeNull();
    });

    it("clears an earlier error when trying again", async () => {
      const { result, pendingOf } = await setup();
      act(() => void result.current.connect("anthropic", "oauth"));
      await act(async () => pendingOf("login").reject(new Error("Nope")));
      act(() => void result.current.connect("anthropic", "oauth"));
      expect(result.current.error).toBeNull();
    });
  });

  describe("disconnect", () => {
    it("signs out and updates the status", async () => {
      const connected: ProviderStatus[] = [
        { id: "anthropic", connected: true, method: "api_key" },
        ...DISCONNECTED.slice(1),
      ];
      const { result } = await setup(
        fakeClient({
          status: connected,
          logout: { id: "anthropic", connected: false },
        }),
      );
      await act(() => result.current.disconnect("anthropic"));
      expect(result.current.statuses?.[0]).toEqual({
        id: "anthropic",
        connected: false,
      });
    });

    it("shows errors against the provider", async () => {
      const { result, pendingOf } = await setup();
      let done: Promise<void>;
      act(() => {
        done = result.current.disconnect("openai");
      });
      await act(async () => {
        pendingOf("logout").reject(new Error("locked"));
        await done;
      });
      expect(result.current.error).toEqual({
        provider: "openai",
        message: "locked",
      });
    });
  });

  it("keeps a sign-in's result even if the first status load hasn't returned", async () => {
    // status never answers; login does.
    const fake = fakeClient({
      login: { id: "openai", connected: true, method: "api_key" },
    });
    const slow = {
      ...fake.client,
      request: vi.fn((req: { type: string }) =>
        req.type === "status"
          ? new Promise(() => {})
          : fake.client.request(req as never),
      ) as typeof fake.client.request,
    };
    const { result } = renderHook(() => useProviders(async () => slow));
    await waitFor(() => expect(slow.request).toHaveBeenCalled());
    await act(() => result.current.connect("openai", "api_key", "sk-x"));
    expect(result.current.statuses).toEqual([
      { id: "openai", connected: true, method: "api_key" },
    ]);
  });

  it("does nothing before the sidecar is ready", async () => {
    const { result } = renderHook(() =>
      useProviders(() => new Promise(() => {})),
    );
    await act(async () => {
      expect(await result.current.connect("anthropic", "oauth")).toBe(false);
      await result.current.disconnect("anthropic");
      await result.current.cancel();
    });
    expect(result.current.login).toBeNull();
  });
});
