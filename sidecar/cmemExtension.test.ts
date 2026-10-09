// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import cmem, { lastAssistantText, withoutWorkState } from "./cmemExtension.ts";
import { APP_NAME } from "../src/lib/app.ts";

let dir: string;
const fetchMock = vi.fn();
type Handler = (event: unknown, ctx: unknown) => unknown;
let handlers: Map<string, Handler>;
const ctx = {
  cwd: "/work/app",
  sessionManager: { getSessionId: () => "s1" },
};
const on = (name: string, event: object = {}) =>
  handlers.get(name)!({ type: name, ...event }, ctx);

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "claude-mem-ext-"));
  vi.stubEnv("CLAUDE_MEM_DATA_DIR", dir);
  vi.stubEnv("HOME", dir);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) =>
    url.endsWith("/api/health")
      ? Response.json({ status: "ok" })
      : new Response("# recent context"),
  );
  handlers = new Map();
  cmem({
    on: (name: string, handler: Handler) => handlers.set(name, handler),
  } as unknown as ExtensionAPI);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await rm(dir, { recursive: true, force: true });
});

const running = () =>
  Promise.all([
    writeFile(join(dir, "worker.pid"), JSON.stringify({ port: 37701 })),
    writeFile(join(dir, "settings.json"), "{}"),
  ]);

const turnedOff = async () => {
  await mkdir(join(dir, `.${APP_NAME}`));
  await writeFile(
    join(dir, `.${APP_NAME}`, "settings.toml"),
    "[memory]\ncmem = false\n",
  );
};

const called = (path: string) =>
  fetchMock.mock.calls.filter(([url]) => (url as string).includes(path));

const posted = () =>
  fetchMock.mock.calls
    .filter(([, init]) => init?.method === "POST")
    .map(([url, init]) => [
      (url as string).replace("http://127.0.0.1:37701", ""),
      JSON.parse(init.body),
    ]);

it("reads the last assistant message's text", () => {
  expect(
    lastAssistantText([
      { role: "assistant", content: [{ type: "text", text: "first" }] },
      { role: "user", content: "next" },
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "hm" },
          { type: "text", text: "done" },
        ],
      },
    ]),
  ).toBe("done");
  expect(lastAssistantText([{ role: "user", content: "hi" }])).toBe("");
});

it("records the session and adds recalled context to the prompt", async () => {
  await running();
  on("session_start");
  expect(
    await on("before_agent_start", { prompt: "fix it", systemPrompt: "base" }),
  ).toEqual({ systemPrompt: "base\n\n# recent context" });
  expect(called("/api/context/inject")[0][0]).toBe(
    "http://127.0.0.1:37701/api/context/inject?projects=app",
  );
  on("tool_result", {
    toolName: "bash",
    toolCallId: "t1",
    input: { command: "ls" },
    content: [{ type: "text", text: "a.ts" }],
  });
  on("agent_end", {
    messages: [{ role: "assistant", content: [{ type: "text", text: "ok" }] }],
  });
  on("session_shutdown", { reason: "reload" });
  on("session_shutdown", { reason: "quit" });
  await vi.waitFor(() => expect(posted()).toHaveLength(4));

  const session = { contentSessionId: "s1", platformSource: APP_NAME };
  expect(posted()).toEqual([
    ["/api/sessions/init", { ...session, project: "app", prompt: "fix it" }],
    [
      "/api/sessions/session-end",
      { ...session, reason: "quit", cwd: "/work/app" },
    ],
    [
      "/api/sessions/observations",
      {
        ...session,
        tool_name: "bash",
        tool_input: { command: "ls" },
        tool_response: "a.ts",
        tool_use_id: "t1",
        cwd: "/work/app",
      },
    ],
    ["/api/sessions/summarize", { ...session, last_assistant_message: "ok" }],
  ]);
});

it.each([
  ["Still open:\n- mode-switching\n  - [todo] Phase 1"],
  ["Nothing open yet."],
])("leaves cmem's work state out of the recalled context (%s)", (open) => {
  const workState = `# Work state: your to-do lists and working state\nUse claude-mem's work_state_write tool.\n- One list per to-do list\n\n${open}`;
  const recent = "# [app] recent context, 2026-10-10\nfacts";
  expect(withoutWorkState(`${workState}\n\n${recent}`)).toBe(recent);
  expect(withoutWorkState(`${recent}\n\n${workState}`)).toBe(`${recent}\n\n`);
  expect(withoutWorkState(recent)).toBe(recent);
});

it("recalls once per session", async () => {
  await running();
  on("session_start");
  await on("before_agent_start", { prompt: "a", systemPrompt: "base" });
  await on("before_agent_start", { prompt: "b", systemPrompt: "base" });
  expect(called("/api/context/inject")).toHaveLength(1);
  on("session_start");
  await on("before_agent_start", { prompt: "c", systemPrompt: "base" });
  expect(called("/api/context/inject")).toHaveLength(2);
});

it("leaves the prompt alone when nothing is recalled", async () => {
  await running();
  fetchMock.mockImplementation(async (url: string) =>
    url.includes("/api/health")
      ? Response.json({ status: "ok" })
      : new Response("", { status: 500 }),
  );
  expect(
    await on("before_agent_start", { prompt: "hi", systemPrompt: "base" }),
  ).toBeUndefined();
});

it.each([
  ["no worker runs", async () => {}],
  ["it's turned off in settings", async () => (await running(), turnedOff())],
])("does nothing when %s", async (_, setUp) => {
  await setUp();
  expect(
    await on("before_agent_start", { prompt: "hi", systemPrompt: "base" }),
  ).toBeUndefined();
  on("tool_result", { content: [] });
  on("agent_end", { messages: [] });
  on("session_shutdown", { reason: "quit" });
  expect(posted()).toEqual([]);
  expect(called("/api/context/inject")).toEqual([]);
});
