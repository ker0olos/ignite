// @vitest-environment node
import { mkdtempSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sessionFor, sessions } from "./sessionStore.ts";

let agentDir: string;
const cwd = "/work";

beforeEach(() => {
  agentDir = mkdtempSync(join(tmpdir(), "sessions-"));
  process.env.PI_CODING_AGENT_DIR = agentDir;
});

afterEach(() => {
  delete process.env.PI_CODING_AGENT_DIR;
  rmSync(agentDir, { recursive: true, force: true });
});

// Listing orders by the last message's time, continuing by the file's.
const touch = (id: string, at: number) =>
  utimesSync(sessionFor(cwd, id).getSessionFile()!, at, at);

const say = (id: string, text: string, at: number) => {
  const s = sessionFor(cwd, id);
  s.appendMessage({ role: "user", content: text, timestamp: at });
  s.appendMessage({
    role: "assistant",
    content: [{ type: "text", text: "ok" }],
    api: "x",
    provider: "x",
    model: "x",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop",
    timestamp: at,
  });
  touch(id, at);
};

describe("sessions", () => {
  it("continues the newest conversation, even an empty one just started", () => {
    say("first", "hello", 1000);
    expect(sessions.latest(cwd)).toBe("first");
    const empty = sessions.create();
    touch(empty, 2000);
    expect(sessions.latest(cwd)).toBe(empty);
    expect(sessionFor(cwd, "first").getSessionId()).toBe("first");
  });

  it("starts a folder with no conversations on a new one", () => {
    expect(sessions.latest(cwd)).toMatch(/\w/);
  });

  it("lists conversations with messages, newest first", async () => {
    say("second", "again", 2000);
    say("first", "hello", 1000);
    touch(sessions.create(), 3000);
    const listed = await sessions.list(cwd);
    expect(listed.map((s) => [s.id, s.title])).toEqual([
      ["second", "again"],
      ["first", "hello"],
    ]);
  });
});
