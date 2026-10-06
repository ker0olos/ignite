/** Which models and efforts a subagent may use, and an explore subagent's defaults. */
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { EFFORTS } from "../shared/subagents.ts";

export type Effort = (typeof EFFORTS)[number];
export type Model = NonNullable<ExtensionContext["model"]>;

// Subscription providers (claude-bridge) list no prices; the same model's
// API listing (anthropic) has them.
/** `model`'s price per million output tokens, from it or its API listing in `all`. */
export function price(model: Model, all: Model[]): number | undefined {
  const priced = (m: Model) => (m.cost?.output > 0 ? m.cost.output : undefined);
  return (
    priced(model) ??
    all
      .filter((m) => m.id === model.id)
      .map(priced)
      .find((p) => p)
  );
}

/** Models a subagent may use: the main model, or one from its provider no dearer per output token. */
export function allowedModels(ctx: ExtensionContext): Model[] {
  const own = ctx.model;
  if (!own) return [];
  const all = ctx.modelRegistry.getAll();
  const ceiling = price(own, all);
  return ctx.modelRegistry.getAvailable().filter((m) => {
    if (m.provider !== own.provider) return false;
    if (m.id === own.id) return true;
    const cost = price(m, all);
    return !!ceiling && !!cost && cost <= ceiling;
  });
}

/** Efforts up to the main agent's own. */
export function allowedEfforts(own: string): Effort[] {
  return EFFORTS.slice(0, EFFORTS.indexOf(own as Effort) + 1);
}

/** The cheapest allowed model; unpriced ones count as the main model. */
function cheapest(ctx: ExtensionContext): Model | undefined {
  const all = ctx.modelRegistry.getAll();
  const cost = (m: Model) => price(m, all) ?? Infinity;
  return allowedModels(ctx).reduce<Model | undefined>(
    (best, m) => (!best || cost(m) < cost(best) ? m : best),
    undefined,
  );
}

/** An explore subagent's defaults: the cheapest model at low effort, or the lowest allowed. */
function exploreDefaults(
  params: { model?: string; effort?: string },
  ctx: ExtensionContext,
  own: string,
) {
  const efforts = allowedEfforts(own);
  return {
    model: params.model ?? cheapest(ctx)?.id,
    effort: params.effort ?? (efforts.includes("low") ? "low" : efforts.at(-1)),
  };
}

/** The requested model and effort, if the rules allow them; left out, the main agent's own (an explore subagent's defaults when exploring). */
export function pick(
  requested: { model?: string; effort?: string; explore?: boolean },
  ctx: ExtensionContext,
  own: string,
) {
  const params = requested.explore
    ? exploreDefaults(requested, ctx, own)
    : {
        model: requested.model ?? ctx.model?.id,
        effort: requested.effort ?? own,
      };
  const models = allowedModels(ctx);
  const model = models.find((m) => m.id === params.model);
  if (!model) {
    throw new Error(
      `Pick a model from: ${models.map((m) => m.id).join(", ")}.`,
    );
  }
  const efforts = allowedEfforts(own);
  const effort = efforts.find((e) => e === params.effort);
  if (!effort) {
    throw new Error(`Pick an effort up to your own: ${efforts.join(", ")}.`);
  }
  return { model, effort };
}
