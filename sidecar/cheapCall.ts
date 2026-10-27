/** The background model calls (router, memory, reflector, judges, procedures, fork reports): one call each, failures logged. */
import type { ImageContent, TextContent } from "@earendil-works/pi-ai";
import { log } from "./hostLog.ts";
import type { Session } from "./hostTypes.ts";
import { price, type Model } from "./subagentModels.ts";

const same = (a: { provider: string; id: string }, b: typeof a) =>
  a.provider === b.provider && a.id === b.id;

/** The cheapest priced model of `s`'s provider, with the provider's models and pi's catalog; null when none lists a price. */
export async function cheapest(s: Pick<Session, "model" | "modelRuntime">) {
  const { model: current, modelRuntime: runtime } = s;
  if (!current) return null;
  const all = runtime.getModels() as Model[];
  const models = (await runtime.getAvailable())
    .filter((m) => m.provider === current.provider)
    .flatMap((m) => all.find((a) => same(a, m)) ?? []);
  const own = models.find((m) => same(m, current));
  if (!own) return null;
  const cost = (m: Model) => price(m, all) ?? Infinity;
  const model = models.reduce((a, b) => (cost(b) < cost(a) ? b : a), own);
  // Unpriced, it would run on the conversation's own model, maybe the dearest.
  return cost(model) === Infinity ? null : { model, models, all };
}

type Options = {
  /** Names the call in the log ("reflector", "memory for <id>"). */
  label: string;
  timeoutMs: number;
  /** The caller's stop, which isn't logged as a failure. */
  signal?: AbortSignal;
};

/** `model`'s reply to `content` under `systemPrompt`; null when the call failed, timed out or was cut off, each logged under `label`. */
export async function askModel(
  s: Pick<Session, "modelRuntime">,
  model: Model,
  systemPrompt: string,
  content: string | (TextContent | ImageContent)[],
  { label, timeoutMs, signal }: Options,
): Promise<string | null> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const failed = (why: string) => {
    if (!signal?.aborted) log(`${label} failed: ${why.slice(0, 200)}`);
  };
  const answer = await s.modelRuntime
    .completeSimple(
      model,
      {
        systemPrompt,
        messages: [{ role: "user", content, timestamp: Date.now() }],
      },
      // "none" keeps claude-bridge from sending it through the conversation's own session.
      {
        cacheRetention: "none",
        signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
      },
    )
    .catch((error: unknown) => {
      failed(String(error));
      return null;
    });
  if (!answer) return null;
  // An error, a timeout (aborted) or a reply cut off (length): what came back can't be used.
  if (answer.stopReason !== "stop") {
    const why = answer.errorMessage ? `: ${answer.errorMessage}` : "";
    failed(timeout.aborted ? "timed out" : `${answer.stopReason}${why}`);
    return null;
  }
  return answer.content
    .flatMap((c) => (c.type === "text" ? [c.text] : []))
    .join("");
}

/** askModel on the cheapest priced model of `s`'s provider; null when there's none (not logged: some providers list no prices). */
export async function askCheapest(
  s: Pick<Session, "model" | "modelRuntime">,
  systemPrompt: string,
  content: string,
  options: Options,
): Promise<string | null> {
  const found = await cheapest(s).catch((error: unknown) => {
    log(`${options.label} failed: ${error}`);
    return null;
  });
  return found
    ? askModel(s, found.model, systemPrompt, content, options)
    : null;
}
