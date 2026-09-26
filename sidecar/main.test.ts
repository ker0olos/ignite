// @vitest-environment node
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { HostMessage } from "../shared/hostProtocol.ts";

// Starts the real sidecar (real pi, real process) with a throwaway home
// folder, so nothing touches the user's credentials.
let home: string;
beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "pi-host-"));
});
afterEach(() => rm(home, { recursive: true, force: true }));

function run(
  input: string,
): Promise<{ messages: HostMessage[]; code: number | null }> {
  const child = spawn(process.execPath, [join(__dirname, "main.ts")], {
    env: { ...process.env, HOME: home, PI_OFFLINE: "1" },
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
});
