// @vitest-environment node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  HostMessage,
  McpServer,
  SessionState,
} from "../shared/hostProtocol.ts";
import { APP_NAME } from "../src/lib/app.ts";

// Starts the real sidecar (real pi, real process) with a throwaway home
// folder, so nothing touches the user's credentials.
let home: string;
beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "pi-host-"));
});
afterEach(() => rm(home, { recursive: true, force: true }));

function run(
  input: string,
  env: Record<string, string> = {},
): Promise<{ messages: HostMessage[]; code: number | null }> {
  const child = spawn(process.execPath, [join(__dirname, "main.ts")], {
    // PATH has only node, so no real Claude Code is found.
    env: {
      ...process.env,
      HOME: home,
      PATH: dirname(process.execPath),
      PI_OFFLINE: "1",
      ...env,
    },
  });
  let out = "";
  child.stdout.on("data", (chunk) => (out += chunk));
  child.stdin.end(input);
  return new Promise((resolve) =>
    child.on("close", (code) =>
      resolve({
        code,
        messages: out
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line)),
      }),
    ),
  );
}

describe("sidecar process", () => {
  it("announces itself, answers requests, and exits cleanly when stdin closes", async () => {
    const { messages, code } = await run('{"id":1,"type":"status"}\n');
    expect(messages[0]).toEqual({ type: "ready" });
    expect(messages[1]).toEqual({
      type: "response",
      id: 1,
      ok: true,
      data: [
        { id: "claude-code", connected: false, installed: false },
        { id: "anthropic", connected: false },
        { id: "openai-codex", connected: false },
        { id: "openai", connected: false },
      ],
    });
    expect(code).toBe(0);
  }, 30_000);

  it("skips lines that aren't JSON and keeps going", async () => {
    const { messages } = await run('not json\n{"id":2,"type":"status"}\n');
    expect(messages.map((m) => m.type)).toEqual(["ready", "response"]);
  }, 30_000);

  it("keeps an API key for a provider in the app's own folder", async () => {
    const { messages } = await run(
      '{"id":1,"type":"login","provider":"openai","method":"api_key","apiKey":"sk-test"}\n' +
        '{"id":2,"type":"logout","provider":"openai"}\n',
    );
    const responses = messages.filter((m) => m.type === "response");
    expect(responses).toEqual([
      {
        type: "response",
        id: 1,
        ok: true,
        data: { id: "openai", connected: true, method: "api_key" },
      },
      {
        type: "response",
        id: 2,
        ok: true,
        data: { id: "openai", connected: false },
      },
    ]);
  }, 30_000);

  it("opens a pi session for a folder with the connected provider's models", async () => {
    const { messages } = await run(
      JSON.stringify({ id: 1, type: "open_session", cwd: home }) + "\n",
      { OPENAI_API_KEY: "sk-test" },
    );
    const response = messages.find((m) => m.type === "response");
    expect(response).toMatchObject({ id: 1, ok: true });
    const state = (response as { data: SessionState }).data;
    expect(state.models.length).toBeGreaterThan(0);
    expect(state.models.every((m) => m.provider === "openai")).toBe(true);
    expect(state.model?.provider).toBe("openai");
    expect(state.thinkingLevels).toContain(state.thinkingLevel);
  }, 30_000);
});

/** A sidecar kept running, for conversations that wait on events. */
function start() {
  const child = spawn(process.execPath, [join(__dirname, "main.ts")], {
    env: {
      ...process.env,
      HOME: home,
      PATH: dirname(process.execPath),
      PI_OFFLINE: "1",
    },
  });
  const messages: HostMessage[] = [];
  let out = "";
  child.stdout.on("data", (chunk) => {
    out += chunk;
    const lines = out.split("\n");
    out = lines.pop()!;
    messages.push(...lines.filter(Boolean).map((l) => JSON.parse(l)));
  });
  return {
    send: (request: object) =>
      child.stdin.write(JSON.stringify(request) + "\n"),
    /** Resolves with the first message (seen so far or later) that matches. */
    next: <T extends HostMessage>(match: (m: HostMessage) => m is T) =>
      vi.waitFor(
        () => {
          const found = messages.find(match);
          if (!found) throw new Error("not yet");
          return found;
        },
        { timeout: 20_000, interval: 50 },
      ),
    stop: () =>
      new Promise((resolve) => {
        child.on("close", resolve);
        child.stdin.end();
      }),
  };
}

describe("MCP servers in the sidecar", () => {
  it("connects the app's servers through pi-mcp-adapter and nothing else", async () => {
    const server = join(__dirname, "testMcpServer.ts");
    const marker = join(home, "started");
    const decoy = {
      command: process.execPath,
      args: [server, "--touch", marker],
    };
    // Shared and project configs the adapter reads by default; never here.
    await mkdir(join(home, ".config", "mcp"), { recursive: true });
    await writeFile(
      join(home, ".config", "mcp", "mcp.json"),
      JSON.stringify({ mcpServers: { shared: decoy } }),
    );
    await writeFile(
      join(home, ".mcp.json"),
      JSON.stringify({ mcpServers: { project: decoy } }),
    );

    const sidecar = start();
    sidecar.send({
      id: 1,
      type: "mcp_save",
      name: "echo",
      config: {
        type: "stdio",
        command: process.execPath,
        args: [server],
        env: {},
      },
    });
    await sidecar.next(
      (m): m is HostMessage => m.type === "response" && m.id === 1,
    );
    sidecar.send({ id: 2, type: "open_session", cwd: home });
    const pushed = await sidecar.next(
      (m): m is Extract<HostMessage, { type: "mcp_servers" }> =>
        m.type === "mcp_servers" && m.servers[0]?.status === "connected",
    );
    expect(pushed.servers).toEqual([
      {
        name: "echo",
        enabled: true,
        config: {
          type: "stdio",
          command: process.execPath,
          args: [server],
          env: {},
        },
        status: "connected",
        tools: ["echo"],
      } satisfies McpServer,
    ]);

    sidecar.send({
      id: 3,
      type: "mcp_set_enabled",
      name: "echo",
      enabled: false,
    });
    const off = await sidecar.next(
      (m): m is Extract<HostMessage, { type: "response" }> =>
        m.type === "response" && m.id === 3,
    );
    expect(off).toMatchObject({
      ok: true,
      data: [{ name: "echo", enabled: false, status: "disabled", tools: [] }],
    });
    await sidecar.stop();

    const saved = JSON.parse(
      await readFile(join(home, `.${APP_NAME}`, "pi", "mcp.json"), "utf8"),
    );
    expect(saved.mcpServers.echo).toMatchObject({ disabled: true });
    expect(existsSync(marker)).toBe(false);
  }, 60_000);
});

describe("project trust in the sidecar", () => {
  it("keeps a folder's own extensions out until the folder is trusted", async () => {
    const project = join(home, "project");
    const marker = join(home, "loaded");
    await mkdir(join(project, ".pi", "extensions"), { recursive: true });
    await writeFile(
      join(project, ".pi", "extensions", "marker.ts"),
      `import { writeFileSync } from "node:fs";\n` +
        `export default function () { writeFileSync(${JSON.stringify(marker)}, "yes"); }\n`,
    );
    const response = (id: number) => (m: HostMessage) =>
      m.type === "response" && m.id === id;

    const sidecar = start();
    sidecar.send({ id: 1, type: "open_session", cwd: project });
    const opened = await sidecar.next((m): m is HostMessage => response(1)(m));
    expect(opened).toMatchObject({ ok: true, data: { trust: "ask" } });
    expect(existsSync(marker)).toBe(false);

    sidecar.send({ id: 2, type: "set_trust", cwd: project, trusted: true });
    const trusted = await sidecar.next((m): m is HostMessage => response(2)(m));
    expect(trusted).toMatchObject({ ok: true });
    expect(existsSync(marker)).toBe(true);
    await sidecar.stop();

    const saved = JSON.parse(
      await readFile(join(home, `.${APP_NAME}`, "pi", "trust.json"), "utf8"),
    );
    // pi saves the real path (macOS's /var is a symlink to /private/var).
    expect(saved).toEqual({ [await realpath(project)]: true });
  }, 60_000);
});
