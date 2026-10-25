// @vitest-environment node
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fallback, {
  answerKeys,
  FALLBACK_KEY_EVENT,
  type FallbackKeyAsk,
} from "./fallbackExtension.ts";
import { limitedUntil, limitUntil } from "./fallback.ts";
import type { FallbackKey } from "./fallbackKeys.ts";

const keys = vi.hoisted(() => ({ list: [] as FallbackKey[] }));
vi.mock("./fallbackKeys.ts", () => ({ loadKeys: async () => keys.list }));

const LIMIT = Symbol.for("ignite.subscriptionLimit");
const HOUR = 60 * 60 * 1000;

type Model = { provider: string; id: string };
type Entry = Record<string, unknown> & { id: string; type: string };
type Handler = (event: object, ctx: object) => Promise<unknown> | unknown;

const limitError =
  "Claude quota exceeded — rate limit (five_hour): out of usage";

function load({ catalog = [] as Model[], setModelOk = true } = {}) {
  const handlers = new Map<string, Handler>();
  const used: { provider: string; key: string | null }[] = [];
  const appended: { customType: string; data: unknown }[] = [];
  const branch: Entry[] = [];
  let model: Model | undefined = {
    provider: "claude-bridge",
    id: "claude-opus-5-5",
  };
  const pi = {
    on: (name: string, h: Handler) => handlers.set(name, h),
    events: {
      emit: (channel: string, data: FallbackKeyAsk) => {
        expect(channel).toBe(FALLBACK_KEY_EVENT);
        used.push({ provider: data.provider, key: data.key });
        data.done(data.key === "bad" ? new Error("no") : undefined);
      },
    },
    setModel: vi.fn(async (m: Model) => {
      if (setModelOk) model = m;
      return setModelOk;
    }),
    appendEntry: (customType: string, data: unknown) =>
      appended.push({ customType, data }),
  };
  fallback(pi as unknown as ExtensionAPI);
  const ctx = () => ({
    model,
    modelRegistry: {
      find: (provider: string, id: string) =>
        catalog.find((m) => m.provider === provider && m.id === id),
    },
    sessionManager: { getBranch: () => branch },
  });
  const fail = (errorMessage: string) =>
    branch.push({
      id: `e${branch.length}`,
      type: "message",
      message: { role: "assistant", stopReason: "error", errorMessage },
    });
  const settle = (outcome = "error") =>
    handlers.get("agent_before_settle")!({ outcome }, ctx()) as Promise<
      { continue: boolean; entries: Entry[] } | undefined
    >;
  const run = (name: string, event: object = {}) =>
    handlers.get(name)!(event, ctx());
  return { used, appended, branch, fail, settle, run, pi, model: () => model };
}

const key = (id: string): FallbackKey => ({ id, key: `key-${id}` });

const opus = { provider: "anthropic", id: "claude-opus-5-5" };

beforeEach(() => {
  keys.list = [key("a"), key("b")];
});
afterEach(() => {
  delete (globalThis as { [LIMIT]?: number })[LIMIT];
  vi.useRealTimers();
});

describe("the fallback extension", () => {
  it("moves a conversation the subscription ran out on to the first key, and continues the run", async () => {
    const x = load({ catalog: [opus] });
    x.fail(limitError);
    const result = await x.settle();
    expect(x.used).toEqual([{ provider: "anthropic", key: "key-a" }]);
    expect(x.model()).toEqual(opus);
    expect(result?.continue).toBe(true);
    expect(result?.entries[0]).toEqual({
      type: "context_edit",
      targetId: "e0",
      replacement: null,
    });
    expect(result?.entries[1]).toMatchObject({
      type: "custom",
      customType: "ignite.fallback",
      data: {
        from: { provider: "claude-bridge", id: "claude-opus-5-5" },
        keyId: "a",
      },
    });
  });

  it("takes the reset from the rejected window's header, else from the error, else an hour", async () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 20, 15, 0) });
    const x = load({ catalog: [opus] });
    await x.run("after_provider_response", {
      headers: { "anthropic-ratelimit-unified-status": "allowed" },
    });
    x.fail(`${limitError} resets 6:30 PM`);
    await x.settle();
    expect(limitedUntil()).toBe(new Date(2026, 9, 20, 18, 30).getTime());

    delete (globalThis as { [LIMIT]?: number })[LIMIT];
    const y = load({ catalog: [opus] });
    const reset = Date.now() / 1000 + 600;
    await y.run("after_provider_response", {
      headers: {
        "anthropic-ratelimit-unified-status": "rejected",
        "anthropic-ratelimit-unified-reset": String(reset),
      },
    });
    y.fail(`${limitError} resets 6:30 PM`);
    await y.settle();
    expect(limitedUntil()).toBe(reset * 1000);

    delete (globalThis as { [LIMIT]?: number })[LIMIT];
    const z = load({ catalog: [opus] });
    z.fail(limitError);
    await z.settle();
    expect(limitedUntil()).toBe(Date.now() + HOUR);
  });

  it("replays a reply the bridge marked aborted after its tool ran, only off the subscription", async () => {
    const x = load({ catalog: [opus] });
    const call = { type: "toolCall", id: "t1" };
    const messages = [
      { role: "assistant", content: [call], stopReason: "aborted" },
      { role: "toolResult", toolCallId: "t1" },
    ];
    expect(await x.run("context", { messages })).toBeUndefined();
    x.fail(limitError);
    await x.settle();
    const result = (await x.run("context", { messages })) as {
      messages: { stopReason?: string }[];
    };
    expect(result.messages[0]!.stopReason).toBe("toolUse");
    expect(messages[0]!.stopReason).toBe("aborted");
  });

  it("leaves runs that didn't fail, or failed some other way on the subscription", async () => {
    const x = load({ catalog: [opus] });
    expect(await x.settle("completed")).toBeUndefined();
    expect(await x.settle()).toBeUndefined();
    x.fail("overloaded");
    expect(await x.settle()).toBeUndefined();
    x.branch.push({ id: "u", type: "message", message: { role: "user" } });
    expect(await x.settle()).toBeUndefined();
    expect(x.used).toEqual([]);
  });

  it("leaves a failure on another provider that isn't a fallback", async () => {
    const x = load({ catalog: [opus] });
    x.pi.setModel(opus);
    x.fail("quota exceeded");
    expect(await x.settle()).toBeUndefined();
  });

  it("goes on to the next key when the one in use fails, and stops after the last", async () => {
    const x = load({ catalog: [opus] });
    x.fail(limitError);
    await x.settle();
    x.fail("401 invalid x-api-key");
    const second = await x.settle();
    expect(x.used.map((u) => u.key)).toEqual(["key-a", "key-b"]);
    expect(second?.entries[1]).toMatchObject({
      data: {
        from: { provider: "claude-bridge", id: "claude-opus-5-5" },
        keyId: "b",
      },
    });
    x.fail("insufficient credit");
    expect(await x.settle()).toBeUndefined();
  });

  it("stays on its key through a failure another key wouldn't fix", async () => {
    const x = load({ catalog: [opus] });
    x.fail(limitError);
    await x.settle();
    for (const error of [
      "overloaded",
      "529",
      "prompt is too long",
      "socket hang up",
    ]) {
      x.fail(error);
      expect(await x.settle()).toBeUndefined();
    }
    expect(x.used.map((u) => u.key)).toEqual(["key-a"]);
  });

  it("skips a key the runtime refuses", async () => {
    keys.list = [{ id: "bad", key: "bad" }, key("a")];
    const x = load({ catalog: [opus] });
    x.fail(limitError);
    const result = await x.settle();
    expect(x.used.map((u) => u.key)).toEqual(["bad", "key-a"]);
    expect(x.model()).toEqual(opus);
    expect(result?.continue).toBe(true);
  });

  it("leaves the failure when no key works", async () => {
    keys.list = [];
    const none = load({ catalog: [opus] });
    none.fail(limitError);
    expect(await none.settle()).toBeUndefined();

    keys.list = [key("a")];
    const noModel = load({ catalog: [] });
    noModel.fail(limitError);
    expect(await noModel.settle()).toBeUndefined();
    expect(noModel.used).toEqual([]);

    keys.list = [key("a")];
    const refused = load({ catalog: [opus], setModelOk: false });
    refused.fail(limitError);
    expect(await refused.settle()).toBeUndefined();
  });

  it("goes back to the subscription with the first message after the reset", async () => {
    vi.useFakeTimers({ now: 1_000_000 });
    const x = load({
      catalog: [opus, { provider: "claude-bridge", id: "claude-opus-5-5" }],
    });
    x.fail(limitError);
    await x.settle();
    await x.run("before_agent_start");
    expect(x.model()).toEqual(opus);

    vi.setSystemTime(1_000_000 + 2 * HOUR);
    await x.run("before_agent_start");
    expect(x.model()).toEqual({
      provider: "claude-bridge",
      id: "claude-opus-5-5",
    });
    expect(x.appended).toEqual([{ customType: "ignite.fallback", data: {} }]);
    expect(x.used.at(-1)).toEqual({ provider: "anthropic", key: null });
    x.pi.setModel.mockClear();
    await x.run("before_agent_start");
    expect(x.pi.setModel).not.toHaveBeenCalled();
  });

  it("stays on the key when the subscription's model is gone", async () => {
    vi.useFakeTimers({ now: 1_000_000 });
    const x = load({ catalog: [opus] });
    x.fail(limitError);
    await x.settle();
    vi.setSystemTime(1_000_000 + 2 * HOUR);
    await x.run("before_agent_start");
    expect(x.model()).toEqual(opus);
    expect(x.appended).toEqual([]);
  });

  it("picks up where a reopened conversation left off: its key, its reset", async () => {
    const x = load({ catalog: [opus] });
    x.branch.push({
      id: "s",
      type: "custom",
      customType: "ignite.fallback",
      data: {
        from: { provider: "claude-bridge", id: "claude-opus-5-5" },
        keyId: "b",
        until: 5,
      },
    });
    x.branch.push({ id: "o", type: "custom", customType: "other" });
    await x.run("session_start");
    expect(x.used).toEqual([{ provider: "anthropic", key: "key-b" }]);
    expect(limitedUntil()).toBe(5);
    x.pi.setModel(opus);
    x.fail("billing");
    expect(await x.settle()).toBeUndefined();
    expect(x.used).toHaveLength(1);
  });

  it("drops nothing going back when it never ran on a key", async () => {
    vi.useFakeTimers({ now: 1_000_000 });
    const x = load({ catalog: [opus] });
    x.branch.push({
      id: "s",
      type: "custom",
      customType: "ignite.fallback",
      data: { from: opus, until: 1 },
    });
    await x.run("session_start");
    await x.run("before_agent_start");
    expect(x.used).toEqual([]);
    expect(x.appended).toHaveLength(1);
  });

  it("starts on a key while the subscription is known to be out, and back after the reset", async () => {
    vi.useFakeTimers({ now: 1_000_000 });
    limitUntil(1_000_000 + HOUR);
    const x = load({
      catalog: [opus, { provider: "claude-bridge", id: "claude-opus-5-5" }],
    });
    await x.run("before_agent_start");
    expect(x.used).toEqual([{ provider: "anthropic", key: "key-a" }]);
    expect(x.model()).toEqual(opus);
    expect(x.appended).toMatchObject([
      { customType: "ignite.fallback", data: { keyId: "a" } },
    ]);

    vi.setSystemTime(1_000_000 + 2 * HOUR);
    await x.run("before_agent_start");
    expect(x.model()).toMatchObject({ provider: "claude-bridge" });
  });

  it("leaves a conversation that isn't on the subscription while it's out", async () => {
    limitUntil(Date.now() + HOUR);
    const x = load({ catalog: [opus] });
    x.pi.setModel({ provider: "openai-codex", id: "gpt-5.5" });
    x.pi.setModel.mockClear();
    await x.run("before_agent_start");
    expect(x.pi.setModel).not.toHaveBeenCalled();
    expect(x.used).toEqual([]);
  });

  it("stays on the subscription, though out, when no key works", async () => {
    limitUntil(Date.now() + HOUR);
    keys.list = [];
    const x = load({ catalog: [opus] });
    await x.run("before_agent_start");
    expect(x.pi.setModel).not.toHaveBeenCalled();
    expect(x.appended).toEqual([]);
  });

  it("starts on the subscription with nothing saved", async () => {
    limitUntil(0);
    const x = load({ catalog: [opus] });
    x.branch.push({ id: "s", type: "custom", customType: "ignite.fallback" });
    await x.run("session_start");
    expect(x.used).toEqual([]);
    await x.run("before_agent_start");
    expect(x.pi.setModel).not.toHaveBeenCalled();
  });
});

describe("answerKeys", () => {
  const runtime = () => ({
    keys: new Map<string, string>(),
    async setRuntimeApiKey(provider: string, key: string) {
      if (key === "bad") throw new Error("refused");
      this.keys.set(provider, key);
    },
    async removeRuntimeApiKey(provider: string) {
      this.keys.delete(provider);
    },
  });

  it("sets and drops the session's keys, and gives subagents those it holds", async () => {
    let handler: (data: unknown) => void = () => {};
    const session = runtime();
    const keys = answerKeys({ on: (_c, h) => (handler = h) }, session);
    const ask = (provider: string, key: string | null) =>
      new Promise<unknown>((done) => handler({ provider, key, done }));
    expect(await ask("anthropic", "k1")).toBeUndefined();
    await ask("openai", "k2");
    await ask("openai", null);
    expect([...session.keys]).toEqual([["anthropic", "k1"]]);
    expect(await ask("openai", "bad")).toBeInstanceOf(Error);

    const subagent = runtime();
    await keys.copyTo(subagent);
    expect(subagent.keys.get("anthropic")).toBe("k1");
  });
});
