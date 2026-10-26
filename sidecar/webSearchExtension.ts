/** web_search: Claude Code's WebSearch, run by Haiku in a separate Claude Code process on the user's Claude login, else the provider's own (apiWebSearch.ts). */
import { tmpdir } from "node:os";
import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { WEB_SEARCH_TOOL } from "../shared/steps.ts";
import { searchApi, searchesOwnApi } from "./apiWebSearch.ts";
import { createClaudeCode, type ClaudeCode } from "./claudeCode.ts";
import { limitedUntil } from "./fallback.ts";

const SYSTEM_PROMPT =
  "You search the web for another agent. Search, then reply with what you found only, no preamble: " +
  "the answer, then each source as a markdown link. Never make up a URL.";

const MAX_TURNS = 8;

/** Runs `request` through Claude Code's WebSearch; its final reply, or throws its error. */
export async function searchWeb(
  request: string,
  signal?: AbortSignal,
  timeoutMs = 120_000,
): Promise<string> {
  signal?.throwIfAborted();
  const abortController = new AbortController();
  const stop = () => abortController.abort();
  signal?.addEventListener("abort", stop);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    stop();
  }, timeoutMs);
  try {
    return await replyOf(
      query({
        prompt: request,
        options: {
          model: "haiku",
          // Only WebSearch: it runs on Anthropic's servers, while WebFetch would
          // fetch from here, outside the sandbox, localhost included.
          tools: ["WebSearch"],
          maxTurns: MAX_TURNS,
          permissionMode: "bypassPermissions",
          // No user settings: their hooks, CLAUDE.md and MCP servers have no place here.
          settingSources: [],
          persistSession: false,
          cwd: tmpdir(),
          // --strict-mcp-config leaves the user's claude.ai connectors on; this drops them.
          env: { ...process.env, ENABLE_CLAUDEAI_MCP_SERVERS: "0" },
          extraArgs: { "strict-mcp-config": null },
          systemPrompt: SYSTEM_PROMPT,
          abortController,
        },
      }),
    );
  } catch (error) {
    if (!timedOut) throw error;
    throw new Error(
      `Web search was stopped after ${timeoutMs / 1000} seconds. Try a narrower request.`,
      { cause: error },
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", stop);
  }
}

async function replyOf(run: AsyncIterable<SDKMessage>): Promise<string> {
  for await (const message of run) {
    if (message.type !== "result") continue;
    if (message.subtype === "success" && !message.is_error) {
      return message.result;
    }
    const why =
      "errors" in message
        ? message.errors.join("; ") || message.subtype
        : message.result;
    throw new Error(`Web search failed: ${why}`);
  }
  throw new Error("Web search ended without a reply.");
}

const RECHECK_MS = 30_000;
const LOGIN_KEY = Symbol.for("ignite:webSearchLogin");
type Login = { loggedIn: Promise<boolean>; at: number };
const store = globalThis as { [LOGIN_KEY]?: Login };

/**
 * Whether Claude Code is signed in, shared by every session's copy of this
 * extension: a yes is kept, a no checked again after RECHECK_MS (answering the
 * old no meanwhile, so a run never waits on the check).
 */
export function claudeSignedIn(claudeCode: ClaudeCode): Promise<boolean> {
  const known = store[LOGIN_KEY];
  if (known && Date.now() - known.at < RECHECK_MS) return known.loggedIn;
  const loggedIn = claudeCode.status().then(
    (status) => status.loggedIn,
    () => false,
  );
  store[LOGIN_KEY] = { loggedIn, at: Date.now() };
  void loggedIn.then((yes) => {
    if (yes) store[LOGIN_KEY] = { loggedIn, at: Infinity };
  });
  return known?.loggedIn ?? loggedIn;
}

/** Whether a call searches on the provider's API: on an Anthropic key only while Claude Code can't (signed out, or out of usage). */
async function onOwnApi(ctx: ExtensionContext, claudeCode: ClaudeCode) {
  if (!searchesOwnApi(ctx)) return false;
  if (ctx.model?.provider !== "anthropic") return true;
  return Date.now() < limitedUntil() || !(await claudeSignedIn(claudeCode));
}

/** Registers web_search, switched on per run when some search can serve it; `claudeCode` is for tests. */
export default function webSearch(
  pi: ExtensionAPI,
  claudeCode: ClaudeCode = createClaudeCode(),
) {
  pi.registerTool({
    name: WEB_SEARCH_TOOL,
    label: "Web search",
    description:
      "Search the web. Takes a request in plain words " +
      '("latest React 19 release notes", "how do Tauri 2 capabilities work") and returns the answer with source links. ' +
      "It reads search results, not whole pages. Use it for research and docs; use the chrome_* tools " +
      "only to read a specific page, test or interact with one.",
    promptSnippet: `${WEB_SEARCH_TOOL}: search the web`,
    parameters: Type.Object({
      request: Type.String({ description: "What to find out." }),
    }),
    async execute(_id, { request }, signal, _onUpdate, ctx) {
      const text = (await onOwnApi(ctx, claudeCode))
        ? await searchApi(ctx, request, SYSTEM_PROMPT, signal)
        : await searchWeb(request, signal);
      return { content: [{ type: "text", text }], details: {} };
    },
  });

  pi.on("before_agent_start", async (_event, ctx) => {
    const on = searchesOwnApi(ctx) || (await claudeSignedIn(claudeCode));
    const others = pi.getActiveTools().filter((n) => n !== WEB_SEARCH_TOOL);
    pi.setActiveTools(on ? [...others, WEB_SEARCH_TOOL] : others);
  });
}
