/**
 * The router: before a conversation's first message (or its next, once the
 * user picks Router), a cheap model from its provider picks the model and
 * effort the conversation runs on.
 */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse as parseToml } from "smol-toml";
import { APP_NAME } from "../src/lib/app.ts";
import { currentModels } from "../shared/featuredModels.ts";
import { EFFORTS } from "../shared/subagents.ts";
import { askModel, cheapest } from "./cheapCall.ts";
import type { Session } from "./hostTypes.ts";
import { price, type Effort, type Model } from "./subagentModels.ts";

/** The router's pick, checked against the provider's models and pi's efforts. */
export type Route = { model?: Model; effort?: Effort };

// A Claude subscription routes through a fresh Claude Code process.
const TIMEOUT_MS = 15_000;

const ROUTER_PROMPT = `You pick the model and effort a coding agent works on. Read the user's message and reply with JSON only, no prose:
{"model": "<id>", "effort": "<level>"}
Pick the cheapest model and lowest effort that will do the work well; the agent keeps them for the rest of the conversation, so pick for the work as a whole. Questions, lookups and mechanical edits: cheap and low. Design, debugging an unknown cause, security and subtle logic: the strongest and high.
Later in a conversation you also get the message it began with: the new message carries on that work ("yes", "continue" mean more of it), so judge them together.
When the message doesn't say enough to tell what the work needs (a bare link, "take a look at this"), pick the middle ground: the newest model between the provider's cheapest and its strongest (on Claude, Sonnet), at high effort.`;

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

// Enough to judge the work; a pasted log would only slow the call down.
const MESSAGE_CHARS = 4_000;

/** The router's user message: the models with prices, the efforts, the message's start and, later on, the conversation's first one's. */
export function routerInput(
  text: string,
  models: { id: string; price?: number }[],
  began?: string,
): string {
  const list = models.map(
    (m) => `- ${m.id}${m.price ? ` ($${m.price}/M output tokens)` : ""}`,
  );
  return [
    `Models:\n${list.join("\n")}`,
    `Efforts, lowest first: ${EFFORTS.join(", ")}`,
    ...(began
      ? [`The conversation began with:\n${began.slice(0, MESSAGE_CHARS)}`]
      : []),
    `The user's message:\n${text.slice(0, MESSAGE_CHARS)}`,
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

/** Asks the cheapest model of `s`'s provider to pick for `text` (in a conversation that `began` so); null when it can't tell, or no model lists a price to call the cheapest. */
export async function route(
  s: Pick<Session, "model" | "modelRuntime">,
  text: string,
  signal?: AbortSignal,
  began?: string,
): Promise<Route | null> {
  const found = await cheapest(s);
  if (!found) return null;
  const { model: router, all } = found;
  const models = currentModels(found.models);
  const reply = await askModel(
    s,
    router,
    ROUTER_PROMPT,
    routerInput(
      text,
      models.map((m) => ({ id: m.id, price: price(m, all) })),
      began,
    ),
    { label: "router", timeoutMs: TIMEOUT_MS, signal },
  );
  return reply === null ? null : parseRoute(reply, models);
}
