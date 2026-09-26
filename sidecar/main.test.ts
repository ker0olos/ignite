// @vitest-environment node
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { HostMessage, SessionState } from "../shared/hostProtocol.ts";

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
