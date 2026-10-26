/** web_search on the conversation's own provider: Anthropic's server-side search (an API or fallback key), or Codex's (a ChatGPT login). */
import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { cheapest } from "./subagentModels.ts";

// Haiku, the cheapest, takes only the basic search tool, not web_search_20260209.
const SEARCH_TOOLS: Record<string, object> = {
  anthropic: { type: "web_search_20250305", name: "web_search", max_uses: 5 },
  "openai-codex": { type: "web_search" },
};

type Ctx = Pick<ExtensionContext, "model" | "modelRegistry">;

/** Whether the conversation's provider can search on its own API: a key, not pi's own Claude sign-in. */
export function searchesOwnApi({ model, modelRegistry }: Ctx): boolean {
  if (!model || !(model.provider in SEARCH_TOOLS)) return false;
  return model.provider !== "anthropic" || !modelRegistry.isUsingOAuth(model);
}

/** Runs `request` through the conversation's provider's search; its reply, or throws its error. */
export async function searchApi(
  ctx: Ctx,
  request: string,
  systemPrompt: string,
  signal?: AbortSignal,
  timeoutMs = 120_000,
): Promise<string> {
  const own = ctx.model;
  if (!own || !searchesOwnApi(ctx)) {
    throw new Error("Web search isn't available on this model.");
  }
  const model = cheapest(ctx as ExtensionContext) ?? own;
  const timeout = AbortSignal.timeout(timeoutMs);
  const reply = await ctx.modelRegistry
    .streamSimple(
      model,
      {
        systemPrompt,
        messages: [{ role: "user", content: request, timestamp: Date.now() }],
      },
      {
        cacheRetention: "none",
        signal: AbortSignal.any([timeout, ...(signal ? [signal] : [])]),
        onPayload: (payload) => ({
          ...(payload as object),
          tools: [SEARCH_TOOLS[own.provider]],
        }),
      },
    )
    .result();
  if (reply.stopReason === "aborted" && timeout.aborted) {
    throw new Error(
      `Web search was stopped after ${timeoutMs / 1000} seconds. Try a narrower request.`,
    );
  }
  return replyText(reply);
}

function replyText(reply: AssistantMessage): string {
  if (reply.stopReason === "error" || reply.stopReason === "aborted") {
    throw new Error(
      `Web search failed: ${reply.errorMessage ?? reply.stopReason}`,
    );
  }
  // Anthropic splits a cited answer into consecutive text blocks.
  const text = reply.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("");
  if (!text) throw new Error("Web search ended without a reply.");
  return text;
}
