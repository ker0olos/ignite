// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APP_NAME } from "../src/lib/app.ts";
import { parseRoute, modelRouterOn, route, routerInput } from "./router.ts";

const model = (provider: string, id: string, output: number) =>
  ({ provider, id, name: id, cost: { output } }) as never;
const MODELS = [
  model("openai-codex", "gpt-big", 10),
  model("openai-codex", "gpt-nano", 1),
  model("claude-bridge", "haiku", 0),
  model("anthropic", "haiku", 5),
];

describe("modelRouterOn", () => {
  let home: string;
  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "router-"));
    vi.stubEnv("HOME", home);
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(home, { recursive: true, force: true });
  });

  it("is on unless the setting turns it off", async () => {
    expect(await modelRouterOn()).toBe(true);
    await mkdir(join(home, `.${APP_NAME}`), { recursive: true });
    const file = join(home, `.${APP_NAME}`, "settings.toml");
    await writeFile(file, "[conversation]\nask_questions = false\n");
    expect(await modelRouterOn()).toBe(true);
    await writeFile(file, "[conversation]\nmodel_router = true\n");
    expect(await modelRouterOn()).toBe(true);
    await writeFile(file, "[conversation]\nmodel_router = false\n");
    expect(await modelRouterOn()).toBe(false);
    await writeFile(file, "not toml [");
    expect(await modelRouterOn()).toBe(true);
  });
});

describe("routerInput", () => {
  it("lists the models with their prices, the efforts and the message", () => {
    const text = routerInput("Add dark mode", [
      { id: "gpt-big", price: 10 },
      { id: "mystery" },
    ]);
    expect(text).toContain("- gpt-big ($10/M output tokens)\n- mystery\n");
    expect(text).toContain("Efforts, lowest first: off, minimal");
    expect(text.endsWith("The user's message:\nAdd dark mode")).toBe(true);
  });
});

describe("parseRoute", () => {
  it("reads the pick, checked against the models and efforts", () => {
    const text = `Sure:\n{"model": "gpt-big", "effort": "medium"}`;
    expect(parseRoute(text, MODELS.slice(0, 2))).toEqual({
      model: MODELS[0],
      effort: "medium",
    });
    const unknown = '{"model": "gpt-gone", "effort": "loud"}';
    expect(parseRoute(unknown, MODELS)).toEqual({ model: undefined });
  });

  it("is null for anything but its JSON", () => {
    expect(parseRoute("no idea", MODELS)).toBeNull();
    expect(parseRoute("null", MODELS)).toBeNull();
  });
});

function session(current: object | undefined, answer: object) {
  const completeSimple = vi.fn(async () => answer);
  return {
    s: {
      model: current,
      modelRuntime: {
        getAvailable: async () => MODELS.slice(0, 3),
        getModels: () => MODELS,
        completeSimple,
      },
    } as never,
    completeSimple,
  };
}

const answer = (text: string, stopReason = "stop") => ({
  stopReason,
  content: [{ type: "thinking" }, { type: "text", text }],
});

describe("route", () => {
  it("asks the provider's cheapest model, in isolation", async () => {
    const { s, completeSimple } = session(
      MODELS[0],
      answer('{"model": "gpt-nano", "effort": "low"}'),
    );
    const routed = await route(s, "What is X?");
    expect(routed).toEqual({ model: MODELS[1], effort: "low" });
    const [picked, context, options] = completeSimple.mock
      .calls[0] as unknown as [
      object,
      { messages: { content: string }[] },
      object,
    ];
    expect(picked).toBe(MODELS[1]);
    expect(context.messages[0].content).toContain("- gpt-nano ($1/M");
    expect(context.messages[0].content).not.toContain("haiku");
    expect(options).toMatchObject({ cacheRetention: "none" });
  });

  it("tells the router a vague message gets the middle-ground model at high effort", async () => {
    const { s, completeSimple } = session(MODELS[0], answer("{}"));
    await route(s, "take a look at https://x");
    const context = (completeSimple.mock.calls[0] as unknown as object[])[1];
    expect((context as { systemPrompt: string }).systemPrompt).toMatch(
      /middle ground.*Sonnet.*high effort/,
    );
  });

  it("prices a subscription model by its API listing", async () => {
    const { s, completeSimple } = session(MODELS[2], answer("{}"));
    await route(s, "Hi");
    const context = (completeSimple.mock.calls[0] as unknown as object[])[1];
    expect(JSON.stringify(context)).toContain("haiku ($5/M");
  });

  it("is null when the call fails or there's no model", async () => {
    const failed = session(MODELS[0], answer("", "error"));
    expect(await route(failed.s, "Hi")).toBeNull();
    const none = session(undefined, answer("{}"));
    expect(await route(none.s, "Hi")).toBeNull();
    const gone = session(model("x", "y", 1), answer("{}"));
    expect(await route(gone.s, "Hi")).toBeNull();
    expect(gone.completeSimple).not.toHaveBeenCalled();
  });

  it("doesn't route when no model lists a price, rather than calling a dear one", async () => {
    const unpriced = model("openai-codex", "gpt-big", 0);
    const { s, completeSimple } = session(unpriced, answer("{}"));
    Object.assign((s as { modelRuntime: object }).modelRuntime, {
      getAvailable: async () => [unpriced],
      getModels: () => [unpriced],
    });
    expect(await route(s, "Hi")).toBeNull();
    expect(completeSimple).not.toHaveBeenCalled();
  });
});
