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
