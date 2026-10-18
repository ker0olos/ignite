// @vitest-environment node
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HostMessage } from "../shared/hostProtocol.ts";
import type { Agent, HostContext, Session } from "./hostTypes.ts";

const prompt = vi.fn<(...args: unknown[]) => Promise<void>>(async () => {});
const settleResume = vi.fn<(agent: Agent) => Promise<void>>(async () => {});
vi.mock("./hostSession.ts", () => ({ prompt }));
vi.mock("./hostSend.ts", () => ({ settleResume }));
vi.mock("./hostProjects.ts", async (real) => ({
  ...(await real<typeof import("./hostProjects.ts")>()),
  pushProjects: vi.fn(),
}));

const { rewind } = await import("./hostRewind.ts");
const { keepCheckpoint, takeCheckpoint } = await import("./checkpoints.ts");

type Entry = ReturnType<Session["sessionManager"]["getBranch"]>[number];

let repo: string;
const git = (...args: string[]) =>
  execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
const read = () => readFileSync(join(repo, "app.ts"), "utf8");

beforeEach(() => {
  repo = realpathSync(mkdtempSync(join(tmpdir(), "host-rewind-")));
  git("init", "-q", "-b", "main");
  git("config", "user.email", "t@t");
  git("config", "user.name", "t");
  writeFileSync(join(repo, "app.ts"), "one\n");
  git("add", "-A");
  git("commit", "-q", "-m", "init");
  prompt.mockClear();
  settleResume.mockClear();
});

afterEach(() => rmSync(repo, { recursive: true, force: true }));

const message = (id: string, role: string, type = "message"): Entry => ({
  id,
  type,
  parentId: null,
  message: { role, timestamp: 1 },
});

/** Conversation s1 with two user messages, u1 and u2, working in `workdir`. */
function setup(workdir = repo, branch = [message("u1", "user")]) {
  branch.push(message("a1", "assistant"), message("u2", "user"));
  const sent: HostMessage[] = [];
  const s = {
    isStreaming: false,
    isCompacting: false,
    pendingMessageCount: 0,
    navigateTree: vi.fn<(id: string) => Promise<{ cancelled: boolean }>>(
      async () => ({ cancelled: false }),
    ),
    setSessionName: vi.fn(),
    sessionManager: { getBranch: () => branch },
  };
  const agent = {
    id: "s1",
    cwd: "/folder",
    workdir,
    title: "First",
    running: false,
    approvals: new Map(),
    followed: true,
    opening: Promise.resolve(s),
  } as unknown as Agent;
  const ctx = {
    send: (m: HostMessage) => sent.push(m),
    shown: "s1",
    agents: new Map([["s1", agent]]),
  } as unknown as HostContext;
  return { ctx, agent, s, sent };
}

const rewound = (sent: HostMessage[]) =>
  sent.flatMap((m) =>
    m.type === "session_event" && m.event.type === "rewound" ? [m.event] : [],
  );

describe("rewind", () => {
  it("puts the files back as they were before the message, goes back to before it, and sends the new text", async () => {
    const { ctx, agent, s, sent } = setup();
    const commit = await takeCheckpoint(repo);
    await keepCheckpoint(repo, "s1", "u2", commit!);
    writeFileSync(join(repo, "app.ts"), "two\n");
    const images = [
      { type: "image" as const, data: "x", mimeType: "image/png" },
    ];
    await rewind(ctx, "s1", "u2", "try three", images);
    expect(read()).toBe("one\n");
    expect(settleResume).toHaveBeenCalledWith(agent);
    expect(s.navigateTree).toHaveBeenCalledWith("u2");
    expect(rewound(sent)).toEqual([
      { type: "rewound", entryId: "u2", files: "restored" },
    ]);
    expect(prompt).toHaveBeenCalledWith(ctx, "try three", images, "s1");
    expect(s.setSessionName).not.toHaveBeenCalled();
    expect(agent.title).toBe("First");
    expect(agent.routed).toBeUndefined();
  });

  it("leaves the files when the message has no checkpoint", async () => {
    const { ctx, sent } = setup();
    writeFileSync(join(repo, "app.ts"), "two\n");
    await rewind(ctx, "s1", "u2", "again");
    expect(read()).toBe("two\n");
    expect(rewound(sent)[0].files).toBe("missing");
  });

  it("rewinds only the conversation in a folder outside git", async () => {
    const { ctx, sent } = setup("/folder");
    await rewind(ctx, "s1", "u2", "again");
    expect(rewound(sent)[0].files).toBe("shared");
  });

  it("tells an app that doesn't follow the conversation nothing", async () => {
    const { ctx, agent, sent } = setup("/folder");
    agent.followed = false;
    ctx.shown = null;
    await rewind(ctx, "s1", "u2", "again");
    expect(sent).toEqual([]);
    expect(prompt).toHaveBeenCalled();
  });

  it("retitles the conversation when its first message is edited", async () => {
    const { ctx, agent, s } = setup("/folder");
    await rewind(ctx, "s1", "u1", "A new start\nwith details");
    expect(agent.title).toBe("A new start");
    expect(s.setSessionName).toHaveBeenCalledWith("A new start");
    expect(agent.routed).toBe(true);
  });

  it("keeps a fork's name when its first message is edited", async () => {
    const { ctx, agent, s } = setup("/folder");
    agent.forkOf = "original";
    await rewind(ctx, "s1", "u1", "A new start");
    expect(agent.title).toBe("First");
    expect(s.setSessionName).not.toHaveBeenCalled();
    expect(agent.routed).toBe(true);
  });

  it.each([
    ["running", (a: Agent) => (a.running = true)],
    ["routing", (a: Agent) => (a.routing = {} as Agent["routing"])],
    ["waiting on approval", (a: Agent) => a.approvals.set("call", {} as never)],
    [
      "streaming",
      (_: Agent, s: Record<string, unknown>) => (s.isStreaming = true),
    ],
    [
      "compacting",
      (_: Agent, s: Record<string, unknown>) => (s.isCompacting = true),
    ],
    [
      "with messages queued",
      (_: Agent, s: Record<string, unknown>) => (s.pendingMessageCount = 1),
    ],
  ])("refuses while %s", async (_, make) => {
    const { ctx, agent, s } = setup();
    make(agent, s);
    await expect(rewind(ctx, "s1", "u2", "x")).rejects.toThrow(
      "Wait for the agent to finish",
    );
    expect(settleResume).not.toHaveBeenCalled();
    expect(s.navigateTree).not.toHaveBeenCalled();
    expect(prompt).not.toHaveBeenCalled();
  });

  it("refuses when the resumed run started meanwhile", async () => {
    const { ctx, agent, s } = setup();
    settleResume.mockImplementationOnce(async (a) => void (a.running = true));
    await expect(rewind(ctx, "s1", "u2", "x")).rejects.toThrow(
      "Wait for the agent to finish",
    );
    expect(agent.running).toBe(true);
    expect(s.navigateTree).not.toHaveBeenCalled();
  });

  it("refuses while it waits on a fork", async () => {
    const { ctx } = setup();
    ctx.agents.set("fork", { id: "fork", forkOf: "s1" } as Agent);
    await expect(rewind(ctx, "s1", "u2", "x")).rejects.toThrow(
      "close the fork first",
    );
  });

  it("refuses a message from before a compaction, or one not on its branch", async () => {
    const { ctx, s } = setup(repo, [
      message("u0", "user"),
      message("c1", "compaction", "compaction"),
      message("u1", "user"),
    ]);
    for (const id of ["u0", "a1", "gone"]) {
      await expect(rewind(ctx, "s1", id, "x")).rejects.toThrow(
        "can't be edited any more",
      );
    }
    expect(s.navigateTree).not.toHaveBeenCalled();
  });

  it("puts the files back when pi won't move, or throws", async () => {
    const { ctx, s, sent } = setup();
    const commit = await takeCheckpoint(repo);
    await keepCheckpoint(repo, "s1", "u2", commit!);
    writeFileSync(join(repo, "app.ts"), "two\n");
    s.navigateTree.mockResolvedValueOnce({ cancelled: true });
    await expect(rewind(ctx, "s1", "u2", "x")).rejects.toThrow(
      "couldn't go back",
    );
    expect(read()).toBe("two\n");
    s.navigateTree.mockRejectedValueOnce(
      new Error("Wait for the current response"),
    );
    await expect(rewind(ctx, "s1", "u2", "x")).rejects.toThrow("Wait for");
    expect(read()).toBe("two\n");
    expect(sent).toEqual([]);
  });

  it("sends nothing when pi doesn't move", async () => {
    const { ctx, s, sent } = setup("/folder");
    s.navigateTree.mockResolvedValueOnce({ cancelled: true });
    await expect(rewind(ctx, "s1", "u2", "x")).rejects.toThrow(
      "couldn't go back",
    );
    expect(sent).toEqual([]);
    expect(prompt).not.toHaveBeenCalled();
  });

  it("refuses a conversation that isn't open", async () => {
    const { ctx } = setup();
    await expect(rewind(ctx, "nope", "u2", "x")).rejects.toThrow("isn't open");
  });
});
