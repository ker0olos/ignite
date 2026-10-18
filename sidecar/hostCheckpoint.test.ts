// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentMessage, UserMessage } from "../shared/agentTypes.ts";
import type { HostMessage } from "../shared/hostProtocol.ts";
import { checkpointRef } from "./checkpoints.ts";
import {
  checkpointFirst,
  followUserMessage,
  inWorktree,
  rewindable,
  withEntryIds,
} from "./hostCheckpoint.ts";
import type { Agent, HostContext, Session } from "./hostTypes.ts";

type Entry = ReturnType<Session["sessionManager"]["getBranch"]>[number];

const user = (text: string, timestamp: number): UserMessage => ({
  role: "user",
  content: text,
  timestamp,
});
const entry = (id: string, message?: Entry["message"], type = "message") => ({
  id,
  type,
  parentId: null,
  ...(message && { message }),
});

describe("rewindable", () => {
  it("lists user messages after the latest compaction", () => {
    const branch = [
      entry("u1", user("old", 1)),
      entry("c1", undefined, "compaction"),
      entry("a1", { role: "assistant" }),
      entry("u2", user("new", 2)),
      entry("x", undefined, "custom_message"),
    ];
    expect(rewindable(branch).map((e) => e.id)).toEqual(["u2"]);
  });
});

describe("withEntryIds", () => {
  it("names the user messages the app may rewind to, by their timestamps", () => {
    const kept = user("kept before the summary", 1);
    const fresh = user("after it", 3);
    const reply: AgentMessage = { role: "assistant", timestamp: 3 };
    const branch = [
      entry("u1", kept),
      entry("c1", undefined, "compaction"),
      entry("u3", fresh),
    ];
    expect(
      withEntryIds({ getBranch: () => branch }, [kept, fresh, reply]),
    ).toEqual([kept, { ...fresh, entryId: "u3" }, reply]);
  });

  it("matches a message with no time to an entry with none", () => {
    const untimed = { role: "user" } as AgentMessage;
    const branch = [entry("u1", { role: "user" })];
    expect(withEntryIds({ getBranch: () => branch }, [untimed])).toEqual([
      { ...untimed, entryId: "u1" },
    ]);
  });
});

let repo: string;
const git = (...args: string[]) =>
  execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();

beforeEach(() => {
  repo = realpathSync(mkdtempSync(join(tmpdir(), "host-checkpoint-")));
  git("init", "-q", "-b", "main");
  git("config", "user.email", "t@t");
  git("config", "user.name", "t");
  writeFileSync(join(repo, "app.ts"), "one\n");
  git("add", "-A");
  git("commit", "-q", "-m", "init");
});

afterEach(() => rmSync(repo, { recursive: true, force: true }));

/** A conversation working in `workdir`, whose session saves messages as pi does (after message_end's listeners). */
function setup(workdir: string, followed = true) {
  const branch: Entry[] = [];
  const sent: HostMessage[] = [];
  const agent = {
    id: "s1",
    cwd: "/folder",
    workdir,
    followed,
    session: { sessionManager: { getBranch: () => branch } },
  } as unknown as Agent;
  const ctx = {
    send: (m: HostMessage) => sent.push(m),
    shown: null,
    agents: new Map([["s1", agent]]),
  } as unknown as HostContext;
  const say = (message: AgentMessage, id = "e1") => {
    followUserMessage(ctx, agent, { type: "message_start", message });
    followUserMessage(ctx, agent, { type: "message_end", message });
    branch.push(entry(id, message));
  };
  return { agent, sent, say, branch, ctx };
}

describe("followUserMessage", () => {
  it("tells the app a user message's entry id and keeps the files as they were as it started", async () => {
    const { agent, sent, branch, ctx } = setup(repo);
    expect(inWorktree(agent)).toBe(true);
    const message = user("make it two", 5);
    followUserMessage(ctx, agent, { type: "message_start", message });
    await agent.snapshot;
    writeFileSync(join(repo, "app.ts"), "two\n");
    followUserMessage(ctx, agent, { type: "message_end", message });
    branch.push(entry("e1", message));
    expect(agent.snapshot).toBeUndefined();
    await vi.waitFor(() => expect(agent.checkpoint).toBeDefined());
    await agent.checkpoint;
    expect(sent).toEqual([
      {
        type: "session_event",
        session: "s1",
        event: { type: "message_entry", timestamp: 5, entryId: "e1" },
      },
    ]);
    expect(git("show", `${checkpointRef("s1", "e1")}:app.ts`)).toBe("one");
  });

  it("keeps the snapshot taken before the run, not a later one", async () => {
    const { agent, say } = setup(repo);
    await checkpointFirst(agent);
    writeFileSync(join(repo, "app.ts"), "two\n");
    say(user("go", 1));
    await vi.waitFor(() => expect(agent.checkpoint).toBeDefined());
    await agent.checkpoint;
    expect(git("show", `${checkpointRef("s1", "e1")}:app.ts`)).toBe("one");
  });

  it("takes no snapshot before a run in the folder itself", async () => {
    const { agent } = setup("/folder");
    await checkpointFirst(agent);
    expect(agent.snapshot).toBeUndefined();
  });

  it("keeps no checkpoint for a conversation in the folder itself, and tells an app that doesn't follow it nothing", async () => {
    const { agent, sent, say } = setup("/folder", false);
    say(user("hi", 1));
    await new Promise((done) => setTimeout(done));
    expect(sent).toEqual([]);
    expect(agent.checkpoint).toBeUndefined();
  });

  it("does nothing for other messages, or one pi didn't save", async () => {
    const { agent, sent } = setup(repo);
    const ctx = { send: () => {} } as unknown as HostContext;
    followUserMessage(ctx, agent, {
      type: "message_start",
      message: { role: "assistant" },
    });
    followUserMessage(ctx, agent, { type: "agent_start" });
    followUserMessage(ctx, agent, {
      type: "message_end",
      message: user("lost", 1),
    });
    await new Promise((done) => setTimeout(done));
    expect(sent).toEqual([]);
    expect(agent.checkpoint).toBeUndefined();
  });

  it("keeps no checkpoint when the snapshot fails", async () => {
    const { agent, say } = setup(join(repo, "missing"));
    say(user("hi", 1));
    await vi.waitFor(() => expect(agent.checkpoint).toBeDefined());
    await agent.checkpoint;
    expect(git("for-each-ref", "--format=%(refname)")).toBe("refs/heads/main");
  });
});
