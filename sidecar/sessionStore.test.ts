// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
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

/** A conversation with one exchange, last active at `at`. */
const say = (id: string, text: string, at: number, workdir = cwd) => {
  const s = sessionFor(cwd, workdir, id);
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
  return s;
};

describe("sessions", () => {
  it("reopens a saved conversation by its id, or starts one with it", () => {
    const saved = say("first", "hello", 1000);
    const again = sessionFor(cwd, cwd, "first");
    expect(again.getSessionFile()).toBe(saved.getSessionFile());
    expect(again.buildSessionContext().messages).toHaveLength(2);
    const fresh = sessionFor(cwd, cwd, "second");
    expect(fresh.getSessionId()).toBe("second");
    expect(fresh.buildSessionContext().messages).toHaveLength(0);
  });

  it("keeps a conversation worked on in a worktree with its folder's", async () => {
    const s = say("a", "in a worktree", 1000, "/worktrees/work-1/a");
    expect(s.getCwd()).toBe("/worktrees/work-1/a");
    expect((await sessions.list(cwd)).map((l) => l.id)).toEqual(["a"]);
    expect(sessionFor(cwd, "/worktrees/work-1/a", "a").getSessionFile()).toBe(
      s.getSessionFile(),
    );
  });

  it("reads a saved conversation's messages, and none of one never saved", async () => {
    say("first", "hello", 1000);
    const read = await sessions.read(cwd, "first");
    expect(read.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(await sessions.read(cwd, "missing")).toEqual([]);
  });

  it("lists conversations with messages, newest first", async () => {
    say("second", "again", 2000);
    say("first", "hello", 1000);
    sessionFor(cwd, cwd, sessions.create());
    const listed = await sessions.list(cwd);
    expect(listed.map((s) => [s.id, s.title])).toEqual([
      ["second", "again"],
      ["first", "hello"],
    ]);
  });
});
