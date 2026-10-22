import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { connectRetry, retryingTools } from "./mcpRetry.ts";

type Tool = Parameters<ExtensionAPI["registerTool"]>[0];
type Details = { error?: string; server?: string; message?: string };

const result = (details: Details, text = "") => ({
  content: [{ type: "text" as const, text }],
  details,
});
const ok = result({ server: "sentry" }, "ok");
const connected = result({ server: "sentry" }, "tools");
const offline = result({
  error: "connect_failed",
  server: "sentry",
  message: "fetch failed",
});
const missing = result({
  error: "connect_failed",
  server: "sentry",
  message: "spawn npx ENOENT",
});
const backoff = result({ error: "server_backoff", server: "sentry" });

const tool = (...results: ReturnType<typeof result>[]) => {
  const execute = vi.fn();
  for (const r of results) execute.mockResolvedValueOnce(r);
  return {
    name: "mcp",
    label: "MCP",
    description: "",
    parameters: Type.Object({}),
    execute,
  } as unknown as Tool & { execute: typeof execute };
};

const call = (wrapped: Tool, args: object = {}, signal?: AbortSignal) =>
  wrapped.execute("id", args, signal, undefined, {} as never);

const run = async (wrapped: Tool, args?: object) => {
  const done = call(wrapped, args);
  await vi.runAllTimersAsync();
  return done;
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("connects again after a network failure, then runs the call", async () => {
  const inner = tool(offline, ok);
  const gateway = tool(offline, connected);
  expect(await run(connectRetry(() => gateway)(inner))).toBe(ok);
  expect(gateway.execute.mock.calls.map((c) => c[1])).toEqual([
    { connect: "sentry" },
    { connect: "sentry" },
  ]);
  expect(inner.execute).toHaveBeenCalledTimes(2);
});

it("names a network still down as the network's", async () => {
  const gateway = tool(offline, offline, offline);
  const out = await run(connectRetry(() => gateway)(tool(offline)));
  expect(out.details).toMatchObject({ error: "connect_failed" });
  expect(out.content[0]).toMatchObject({
    text: expect.stringContaining("in 4 tries"),
  });
});

it("returns a real connect error at once", async () => {
  const gateway = tool();
  expect(await run(connectRetry(() => gateway)(tool(missing)))).toBe(missing);
  expect(gateway.execute).not.toHaveBeenCalled();
});

it("connects once, without waiting, to learn why a server is in backoff", async () => {
  const gateway = tool(missing);
  const retry = connectRetry(() => gateway);
  const done = call(retry(tool(backoff)));
  await vi.advanceTimersByTimeAsync(0);
  expect(await done).toBe(missing);
  expect(await run(retry(tool(backoff)))).toBe(backoff);
  expect(gateway.execute).toHaveBeenCalledTimes(1);
});

it("shares one connect between parallel calls", async () => {
  const gateway = tool(connected);
  const retry = connectRetry(() => gateway);
  const calls = [
    call(retry(tool(offline, ok))),
    call(retry(tool(offline, ok))),
  ];
  await vi.runAllTimersAsync();
  expect(await Promise.all(calls)).toEqual([ok, ok]);
  expect(gateway.execute).toHaveBeenCalledTimes(1);
});

it("runs again without connecting once another call connected", async () => {
  const gateway = tool(connected);
  const retry = connectRetry(() => gateway);
  await run(retry(tool(offline, ok)));
  // A call that started before that connect, failing after it.
  vi.setSystemTime(Date.now() - 1);
  expect(await run(retry(tool(offline, ok)))).toBe(ok);
  expect(gateway.execute).toHaveBeenCalledTimes(1);
});

it("doesn't run a connect twice", async () => {
  const inner = tool(offline);
  const wrapped = connectRetry(() => tool(connected))(inner);
  expect(await run(wrapped, { connect: "sentry" })).toBe(connected);
  expect(inner.execute).toHaveBeenCalledTimes(1);
});

it("stops waiting when the call is aborted", async () => {
  const controller = new AbortController();
  const done = call(
    connectRetry(() => tool())(tool(offline)),
    {},
    controller.signal,
  );
  controller.abort(new Error("stopped"));
  await expect(done).rejects.toThrow("stopped");
});

it("leaves results without a server, or with no gateway, alone", async () => {
  const other = result({ error: "tool_error" });
  expect(await run(connectRetry(() => tool())(tool(other)))).toBe(other);
  expect(await run(connectRetry(() => undefined)(tool(offline)))).toBe(offline);
});

it("retries through the mcp tool registered alongside", async () => {
  const registered: Tool[] = [];
  const pi = { registerTool: (t: Tool) => registered.push(t) };
  const wrapping = retryingTools(pi as unknown as ExtensionAPI);
  const direct = { ...tool(offline, ok), name: "sentry_find" };
  wrapping.registerTool(direct);
  wrapping.registerTool(tool(connected));
  expect(await run(registered[0])).toBe(ok);
});
