/** A model worth showing up front, with the name and blurb the menu uses. */
type Featured = {
  /** Where the model may come from, preferred first. */
  providers: string[];
  id: string;
  label: string;
  description?: string;
};

// ponytail: hand-picked; update when providers ship new models.
export const FEATURED: Featured[] = [
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
    id: "gpt-6.1-sol",
    label: "GPT-6.1 Sol",
    description: "Strong reasoning for complex coding",
  },
  {
    providers: ["openai-codex"],
    id: "gpt-6-luna",
    label: "GPT-6 Luna",
    description: "Fast and efficient for everyday tasks",
  },
];

/** The featured (current generation) ones among `models`, or all of them when none is. */
export function currentModels<M extends { provider: string; id: string }>(
  models: M[],
): M[] {
  const current = models.filter((m) =>
    FEATURED.some((f) => f.id === m.id && f.providers.includes(m.provider)),
  );
  return current.length ? current : models;
}
