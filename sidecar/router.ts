/**
 * The router: before a conversation's first message, a cheap model from its
 * provider picks the model and effort the conversation runs on.
 */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse as parseToml } from "smol-toml";
import { APP_NAME } from "../src/lib/app.ts";
import { EFFORTS } from "../shared/subagents.ts";
import type { Session } from "./hostTypes.ts";
import { price, type Effort, type Model } from "./subagentModels.ts";

/** The router's pick, checked against the provider's models and pi's efforts. */
export type Route = { model?: Model; effort?: Effort };

const same = (a: { provider: string; id: string }, b: typeof a) =>
  a.provider === b.provider && a.id === b.id;

// A Claude subscription routes through a fresh Claude Code process.
const TIMEOUT_MS = 15_000;

const ROUTER_PROMPT = `You pick the model and effort a coding agent works on. Read the user's first message and reply with JSON only, no prose:
{"model": "<id>", "effort": "<level>"}
Pick the cheapest model and lowest effort that will do the work well; the agent keeps them for the whole conversation, so pick for the work as a whole. Questions, lookups and mechanical edits: cheap and low. Design, debugging an unknown cause, security and subtle logic: the strongest and high.
When the message doesn't say enough to tell what the work needs (a bare link, "take a look at this", "continue"), pick the middle ground: the newest model between the provider's cheapest and its strongest (on Claude, Sonnet), at high effort.`;

/** Whether the router picks the model and effort ("Model Router", `[conversation] model_router`, on by default). */
export async function modelRouterOn(
  settingsFile = join(homedir(), `.${APP_NAME}`, "settings.toml"),
): Promise<boolean> {
  try {
    const settings = parseToml(await readFile(settingsFile, "utf8"));
    const conversation = settings.conversation as
      { model_router?: unknown } | undefined;
    return conversation?.model_router !== false;
  } catch {
    return true;
  }
}

/** The router's user message: the models with prices, the efforts and the message. */
export function routerInput(
  text: string,
  models: { id: string; price?: number }[],
): string {
  const list = models.map(
    (m) => `- ${m.id}${m.price ? ` ($${m.price}/M output tokens)` : ""}`,
  );
  return [
    `Models:\n${list.join("\n")}`,
    `Efforts, lowest first: ${EFFORTS.join(", ")}`,
    `The user's message:\n${text}`,
  ].join("\n\n");
}

/** The router's JSON reply, its unknown model and effort dropped; null when it isn't one. */
export function parseRoute(text: string, models: Model[]): Route | null {
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  let raw: { model?: unknown; effort?: unknown };
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const effort = EFFORTS.find((e) => e === raw.effort);
  return {
    model: models.find((m) => m.id === raw.model),
    ...(effort && { effort }),
  };
}

/** Asks the cheapest model of `s`'s provider to pick for `text`; null when it can't tell, or no model lists a price to call the cheapest. */
export async function route(
  s: Pick<Session, "model" | "modelRuntime">,
  text: string,
  signal?: AbortSignal,
): Promise<Route | null> {
  const { model: current, modelRuntime: runtime } = s;
  if (!current) return null;
  const all = runtime.getModels() as Model[];
  const models = (await runtime.getAvailable())
    .filter((m) => m.provider === current.provider)
    .flatMap((m) => all.find((a) => same(a, m)) ?? []);
  const own = models.find((m) => same(m, current));
  if (!own) return null;
  const cost = (m: Model) => price(m, all) ?? Infinity;
  const router = models.reduce((a, b) => (cost(b) < cost(a) ? b : a), own);
  // Unpriced, the router would run on the conversation's own model, maybe the dearest.
  if (cost(router) === Infinity) return null;
  const answer = await runtime.completeSimple(
    router,
    {
      systemPrompt: ROUTER_PROMPT,
      messages: [
        {
          role: "user",
          content: routerInput(
            text,
            models.map((m) => ({ id: m.id, price: price(m, all) })),
          ),
          timestamp: Date.now(),
        },
      ],
    },
    // "none" keeps claude-bridge from sending it through the conversation's own session.
    {
      cacheRetention: "none",
      signal: AbortSignal.any([
        AbortSignal.timeout(TIMEOUT_MS),
        ...(signal ? [signal] : []),
      ]),
    },
  );
  if (answer.stopReason === "error" || answer.stopReason === "aborted") {
    return null;
  }
  const reply = answer.content
    .flatMap((c) => (c.type === "text" ? [c.text] : []))
    .join("");
  return parseRoute(reply, models);
}
