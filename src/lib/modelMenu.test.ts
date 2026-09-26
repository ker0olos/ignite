import { describe, expect, it } from "vitest";
import type { ModelInfo } from "../../shared/hostProtocol";
import { modelLabel, modelMenu } from "./modelMenu";

const m = (provider: string, id: string, name: string): ModelInfo => ({
  provider,
  id,
  name,
});
const opus55 = m("anthropic", "claude-opus-5-5", "Claude Opus 5.5");
const haiku = m("anthropic", "claude-haiku-4-5", "Claude Haiku 4.5 (latest)");
const haikuDated = m(
  "anthropic",
  "claude-haiku-4-5-20251001",
  "Claude Haiku 4.5",
);
const opus45 = m("anthropic", "claude-opus-4-5", "Claude Opus 4.5 (latest)");
const opus45Dated = m(
  "anthropic",
  "claude-opus-4-5-20251101",
  "Claude Opus 4.5",
);
const sol = m("openai-codex", "gpt-6-sol", "GPT-6 Sol");
const spark = m("openai-codex", "gpt-5.3-codex-spark", "GPT-5.3 Codex Spark");

describe("modelMenu", () => {
  it("features hand-picked models by brand, in the featured order", () => {
    const { featured } = modelMenu([sol, haiku, opus55]);
    expect(featured).toEqual([
      {
        name: "Claude",
        models: [
          {
            ...opus55,
            label: "Opus 5.5",
            description: "Most capable for ambitious work",
          },
          {
            ...haiku,
            label: "Haiku 4.5",
            description: "Fastest for quick answers",
          },
        ],
      },
      {
        name: "ChatGPT",
        models: [
          {
            ...sol,
            label: "GPT-6 Sol",
            description: "Strong reasoning for complex coding",
          },
        ],
      },
    ]);
  });

  it("leaves featured models that aren't available out", () => {
    expect(modelMenu([spark]).featured).toEqual([]);
  });

  it("lists every other model once, without the (latest) suffix", () => {
    const { more } = modelMenu([
      haiku,
      haikuDated,
      opus45,
      opus45Dated,
      opus55,
      spark,
    ]);
    expect(more).toEqual([
      { name: "Claude", models: [{ ...opus45, label: "Claude Opus 4.5" }] },
      {
        name: "ChatGPT",
        models: [{ ...spark, label: "GPT-5.3 Codex Spark" }],
      },
    ]);
  });
});

describe("modelLabel", () => {
  it("uses the featured label, or pi's name", () => {
    expect(modelLabel(opus55)).toBe("Opus 5.5");
    expect(modelLabel(spark)).toBe("GPT-5.3 Codex Spark");
    expect(modelLabel(opus45)).toBe("Claude Opus 4.5");
  });
});

describe("the Claude Code bridge", () => {
  const bridged = (model: ModelInfo) => ({
    ...model,
    provider: "claude-bridge",
  });

  it("features the bridge's Claude models over pi's own", () => {
    const { featured, more } = modelMenu([opus55, bridged(opus55)]);
    expect(featured[0].models).toEqual([
      expect.objectContaining({ provider: "claude-bridge", label: "Opus 5.5" }),
    ]);
    expect(more).toEqual([]);
    expect(modelLabel(bridged(opus55))).toBe("Opus 5.5");
  });

  it("lists other Claude models once, from the bridge", () => {
    const { more } = modelMenu([opus45Dated, bridged(opus45Dated), spark]);
    expect(more[0]).toEqual({
      name: "Claude",
      models: [{ ...bridged(opus45Dated), label: "Claude Opus 4.5" }],
    });
    const reversed = modelMenu([bridged(opus45Dated), opus45Dated]).more;
    expect(reversed[0].models[0].provider).toBe("claude-bridge");
  });

  it("keeps models from providers outside any brand", () => {
    const gemini = m("google", "gemini", "Gemini");
    expect(modelMenu([gemini, gemini]).more).toEqual([
      { name: "google", models: [{ ...gemini, label: "Gemini" }] },
    ]);
  });
});
