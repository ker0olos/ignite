import type { ModelInfo, ThinkingLevel } from "../../shared/hostProtocol";
import { PROVIDER_GROUPS, providerName } from "./providerGroups";

/** A model worth showing up front, with the name and blurb the menu uses. */
type Featured = {
  /** Where the model may come from, preferred first. */
  providers: string[];
  id: string;
  label: string;
  description?: string;
};

// ponytail: hand-picked; update when providers ship new models.
const FEATURED: Featured[] = [
  {
    providers: ["claude-bridge", "anthropic"],
    id: "claude-fable-5-1",
    label: "Fable 5.1",
    description: "For your toughest challenges",
  },
  {
    providers: ["claude-bridge", "anthropic"],
    id: "claude-opus-5-5",
    label: "Opus 5.5",
    description: "Most capable for ambitious work",
  },
  {
    providers: ["claude-bridge", "anthropic"],
    id: "claude-sonnet-5-5",
    label: "Sonnet 5.5",
    description: "Most efficient for everyday tasks",
  },
  {
    providers: ["claude-bridge", "anthropic"],
    id: "claude-haiku-5-5",
    label: "Haiku 5.5",
    description: "Fastest for quick answers",
  },
  {
    providers: ["openai-codex"],
    id: "gpt-6-astra",
    label: "GPT-6 Astra",
    description: "For your toughest, multi-step work",
  },
  {
    providers: ["openai-codex"],
    id: "gpt-6-sol",
    label: "GPT-6 Sol",
    description: "Strong reasoning for complex coding",
  },
  {
    providers: ["openai-codex"],
    id: "gpt-6-luna",
    label: "GPT-6 Luna",
    description: "Fast and efficient for everyday tasks",
  },
];

type MenuModel = ModelInfo & { label: string; description?: string };
export type MenuGroup = { name: string; models: MenuModel[] };

/** Whether two entries name the same model. */
export const same = (a: { provider: string; id: string }, b: typeof a) =>
  a.provider === b.provider && a.id === b.id;

const LATEST = " (latest)";

// pi lists an alias such as "Claude Opus 4.5 (latest)" beside the dated model.
const baseName = (name: string) =>
  name.endsWith(LATEST) ? name.slice(0, -LATEST.length) : name;

/**
 * Splits pi's available models into a short featured list and the rest, both
 * grouped by brand. Each model appears once: aliases and the models they
 * point to share a name.
 */
export function modelMenu(models: readonly ModelInfo[]): {
  featured: MenuGroup[];
  more: MenuGroup[];
} {
  const featured = FEATURED.flatMap((f) => {
    const model = f.providers
      .map((provider) => models.find((m) => same(m, { provider, id: f.id })))
      .find(Boolean);
    return model
      ? [{ ...model, label: f.label, description: f.description }]
      : [];
  });
  const taken = new Set(featured.map((m) => baseName(m.name)));
  // One entry per name; the brand's preferred provider wins (the Claude Code
  // bridge over pi's own Claude sign-in).
  const more = new Map<string, MenuModel>();
  for (const m of models) {
    const label = baseName(m.name);
    const kept = more.get(label);
    if (taken.has(label) || (kept && rank(kept) <= rank(m))) continue;
    more.set(label, { ...m, label });
  }
  return { featured: byBrand(featured), more: byBrand([...more.values()]) };
}

/** The short name for the menu button: the featured label, or pi's name. */
export function modelLabel(model: ModelInfo): string {
  return (
    FEATURED.find(
      (f) => f.providers.includes(model.provider) && f.id === model.id,
    )?.label ?? baseName(model.name)
  );
}

/** The model menu button's text: "Router" while Model Router picks, else the model. */
export function modelTriggerLabel(
  model?: ModelInfo,
  modelRouter = false,
): string {
  if (modelRouter) return "Router";
  return model ? modelLabel(model) : "Choose a model";
}

const rank = (m: ModelInfo) =>
  PROVIDER_GROUPS.find((g) =>
    g.modelProviders.includes(m.provider),
  )?.modelProviders.indexOf(m.provider) ?? 0;

function byBrand(models: MenuModel[]): MenuGroup[] {
  const groups = new Map<string, MenuModel[]>();
  for (const m of models) {
    const name = providerName(m.provider);
    groups.set(name, [...(groups.get(name) ?? []), m]);
  }
  return [...groups].map(([name, models]) => ({ name, models }));
}

export const EFFORT_LABELS: Record<ThinkingLevel, string> = {
  off: "Off",
  minimal: "Minimal",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra high",
  max: "Max",
};
