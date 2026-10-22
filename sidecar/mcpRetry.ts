/**
 * MCP connects the network failed are tried again before the agent sees them,
 * then named as the network's. Only connecting is retried: no call ran yet.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { wrappedTools } from "./toolReason.ts";

type Tool = Parameters<ExtensionAPI["registerTool"]>[0];
type Result = Awaited<ReturnType<Tool["execute"]>>;
type Ctx = Parameters<Tool["execute"]>[4];
type Details = { error?: string; server?: string; message?: string };

// undici reports DNS, refused and reset connections alike as "fetch failed".
const NETWORK =
  /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|socket hang up|other side closed|HTTP 50[234]/i;
// The adapter answers server_backoff (server_unavailable from direct tools)
// for a minute after any failed connect, without saying why.
const UNREACHED = new Set([
  "connect_failed",
  "server_backoff",
  "server_unavailable",
]);
const BACKOFF_MS = 60_000;
const RETRY_DELAYS_MS = [2_000, 5_000, 10_000];

function untilAborted<T>(promise: Promise<T>, signal?: AbortSignal) {
  if (!signal) return promise;
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    if (signal.aborted) return abort();
    signal.addEventListener("abort", abort, { once: true });
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}

const sleep = (ms: number, signal?: AbortSignal) =>
  untilAborted(new Promise((resolve) => setTimeout(resolve, ms)), signal);

const detailsOf = (result: Result) => (result.details ?? {}) as Details;

function isNetworkFailure(result: Result): boolean {
  const { error, message = "" } = detailsOf(result);
  return error === "connect_failed" && NETWORK.test(message);
}

function networkNote(result: Result, tries: number): Result {
  const { server, message } = detailsOf(result);
  const text =
    `Couldn't reach MCP server "${server}" (${message}) in ${tries} tries. ` +
    "This is the network or a brief outage, not your call: retry with " +
    `mcp({ connect: "${server}" }) in a little while before looking for another way.`;
  return { ...result, content: [{ type: "text", text }] };
}

/** Wraps MCP tools so their server connects again while the network keeps it out of reach. */
export function connectRetry(gateway: () => Tool | undefined) {
  const failures = new Map<string, { network: boolean; at: number }>();
  const connects = new Map<string, Promise<Result>>();
  const connectedAt = new Map<string, number>();

  const remember = (server: string, result: Result) => {
    const { error } = detailsOf(result);
    if (!error) {
      failures.delete(server);
      connectedAt.set(server, Date.now());
    } else if (error === "connect_failed") {
      failures.set(server, {
        network: isNetworkFailure(result),
        at: Date.now(),
      });
    }
  };

  // Connecting a connected server reconnects it, so parallel calls share one.
  const connect = (server: string, ctx: Ctx) => {
    let pending = connects.get(server);
    if (!pending) {
      const mcp = gateway()!;
      pending = mcp
        .execute("mcp-retry", { connect: server }, undefined, undefined, ctx)
        .then((result) => (remember(server, result), result))
        .finally(() => connects.delete(server));
      connects.set(server, pending);
    }
    return pending;
  };

  /** "wait" for a network failure, "connect" to learn why a server is in backoff. */
  const step = (result: Result) => {
    const { error, server } = detailsOf(result);
    if (!server || !gateway() || !UNREACHED.has(error ?? "")) return undefined;
    if (error === "connect_failed") remember(server, result);
    const known = failures.get(server);
    if (!known || Date.now() - known.at > BACKOFF_MS) return "connect";
    return known.network ? "wait" : undefined;
  };

  return (tool: Tool): Tool =>
    ({
      ...tool,
      execute: async (id, args, signal, onUpdate, ctx) => {
        const own = (args as { connect?: string }).connect !== undefined;
        let started = Date.now();
        let result = await tool.execute(id, args, signal, onUpdate, ctx);
        let tries = 1;
        for (const ms of RETRY_DELAYS_MS) {
          const next = step(result);
          if (!next) return result;
          if (next === "wait") await sleep(ms, signal);
          const server = detailsOf(result).server!;
          if ((connectedAt.get(server) ?? 0) <= started) {
            const connected = await untilAborted(connect(server, ctx), signal);
            tries++;
            if (own || detailsOf(connected).error) {
              result = connected;
              continue;
            }
          }
          started = Date.now();
          result = await tool.execute(id, args, signal, onUpdate, ctx);
          tries++;
        }
        return isNetworkFailure(result) ? networkNote(result, tries) : result;
      },
    }) as Tool;
}

/** `pi` with every MCP tool registered through it retrying network connect failures. */
export function retryingTools(pi: ExtensionAPI): ExtensionAPI {
  let gateway: Tool | undefined;
  const retrying = connectRetry(() => gateway);
  return wrappedTools(pi, (tool) => {
    if (tool.name === "mcp") gateway = tool;
    return retrying(tool);
  });
}
