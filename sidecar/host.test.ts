// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { HostMessage, HostRequest } from "../shared/hostProtocol.ts";
import { createHost, describeError, type Runtime } from "./host.ts";

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

/** Wires a host to a fake runtime and records everything it sends. */
function setup(runtime: Runtime) {
  const sent: HostMessage[] = [];
  const host = createHost(runtime, (m) => sent.push(m));
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
          { id: "anthropic", connected: true, method: "oauth" },
          { id: "openai-codex", connected: false },
          { id: "openai", connected: false },
        ],
      },
    ]);
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
