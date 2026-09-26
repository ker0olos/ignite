import type { ModelInfo, ThinkingLevel } from "../../shared/hostProtocol";
import { providerName } from "./providerGroups";

/** A model worth showing up front, with the name and blurb the menu uses. */
type Featured = {
  provider: string;
  id: string;
  label: string;
  description?: string;
};

// ponytail: hand-picked; update when providers ship new models.
const FEATURED: Featured[] = [
  {
    provider: "anthropic",
    id: "claude-fable-5-1",
    label: "Fable 5.1",
    description: "For your toughest challenges",
  },
  {
    provider: "anthropic",
    id: "claude-opus-5-5",
    label: "Opus 5.5",
    description: "Most capable for ambitious work",
  },
  {
    provider: "anthropic",
    id: "claude-sonnet-5",
    label: "Sonnet 5",
    description: "Most efficient for everyday tasks",
  },
  {
    provider: "anthropic",
    id: "claude-haiku-4-5",
    label: "Haiku 4.5",
    description: "Fastest for quick answers",
  },
  {
    provider: "openai-codex",
    id: "gpt-6-astra",
    label: "GPT-6 Astra",
    description: "For your toughest, multi-step work",
  },
  {
    provider: "openai-codex",
    id: "gpt-6-sol",
    label: "GPT-6 Sol",
    description: "Strong reasoning for complex coding",
  },
  {
    provider: "openai-codex",
    id: "gpt-6-luna",
    label: "GPT-6 Luna",
    description: "Fast and efficient for everyday tasks",
  },
];

export type MenuModel = ModelInfo & { label: string; description?: string };
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
    const model = models.find((m) => same(m, f));
    return model
      ? [{ ...model, label: f.label, description: f.description }]
      : [];
  });
  const seen = new Set(featured.map((m) => baseName(m.name)));
  const more: MenuModel[] = [];
  for (const m of models) {
    const label = baseName(m.name);
    if (seen.has(label)) continue;
    seen.add(label);
    more.push({ ...m, label });
  }
  return { featured: byBrand(featured), more: byBrand(more) };
}

/** The short name for the menu button: the featured label, or pi's name. */
export function modelLabel(model: ModelInfo): string {
  return FEATURED.find((f) => same(f, model))?.label ?? baseName(model.name);
}

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
