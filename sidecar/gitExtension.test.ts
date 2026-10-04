// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createEventBus,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Task, TaskUpdate } from "../shared/tasks.ts";
import { APP_NAME } from "../src/lib/app.ts";
import {
  APPROVAL_EVENT,
  DENIED,
  type ApprovalAsk,
} from "./approvalExtension.ts";
import gitTools, {
  PR_DECLINED,
  USE_TOOLS,
  delivers,
  needsTools,
} from "./gitExtension.ts";
import { resultText, run } from "./gitRun.ts";
import { TASK_EVENT, type TaskAsk } from "./taskExtension.ts";

let home: string;
let repo: string;

// A review runs several git commands before it asks, slow under a full test run.
const asked = (asks: unknown[]) =>
  vi.waitFor(() => expect(asks).toHaveLength(1), { timeout: 5000 });
beforeEach(async () => {
  home = await realpath(await mkdtemp(join(tmpdir(), "git-tools-")));
  repo = join(home, "app");
  await mkdir(repo);
  vi.stubEnv("HOME", home);
  for (const who of ["AUTHOR", "COMMITTER"]) {
    vi.stubEnv(`GIT_${who}_NAME`, "Me");
    vi.stubEnv(`GIT_${who}_EMAIL`, "me@example.com");
  }
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: repo });
  await writeFile(join(repo, "a.txt"), "one\n");
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(home, { recursive: true, force: true });
});

type Execute = (
  id: string,
  params: { args: string[]; push?: boolean },
  signal: AbortSignal | undefined,
  onUpdate: undefined,
  ctx: { cwd: string },
) => Promise<{ content: { text: string }[]; details?: unknown }>;

const mine: Task = {
  id: "t",
  title: "T",
  notes: "",
  images: [],
  subtasks: [],
  created: 1,
  updated: 1,
};

async function approvalSettings(approval: string) {
  await mkdir(join(home, `.${APP_NAME}`));
  await writeFile(
    join(home, `.${APP_NAME}`, "settings.toml"),
    `[approval]\n${approval}\n`,
  );
}

function load(task: Task | null = null) {
  const events = createEventBus();
  const tools = new Map<string, Execute>();
  const handlers = new Map<string, (event: object) => Promise<unknown>>();
  gitTools({
    registerTool: (t: { name: string; execute: Execute }) =>
      tools.set(t.name, t.execute),
    on: (name: string, h: (event: object) => Promise<unknown>) =>
      handlers.set(name, h),
    events,
  } as unknown as ExtensionAPI);
  const asks: ApprovalAsk[] = [];
  events.on(APPROVAL_EVENT, (data) => void asks.push(data as ApprovalAsk));
  const updates: TaskUpdate[] = [];
  events.on(TASK_EVENT, (data) => {
    const ask = data as TaskAsk;
    if (!task) return;
    ask.heard = true;
    if (ask.kind === "update") updates.push(ask.update);
    ask.reply(task);
  });
  const call = (tool: string, args: string[], cwd = repo, push?: boolean) =>
    tools.get(tool)!("t1", { args, push }, undefined, undefined, { cwd });
  const bash = (command: string) =>
    handlers.get("tool_call")!({ toolName: "bash", input: { command } });
  return { asks, updates, call, bash };
}

describe("the git tool", () => {
  it("runs reads and local changes without asking", async () => {
    const { asks, call } = load();
    await call("git", ["add", "a.txt"]);
    const status = await call("git", ["status", "--short"]);
    expect(status.content[0].text).toBe("A  a.txt");
    expect(asks).toEqual([]);
  });

  it("shows a commit's changes, commits once approved, and keeps its diff", async () => {
    const { asks, call } = load();
    await call("git", ["add", "a.txt"]);
    const done = call("git", ["commit", "-m", "first"]);
    await asked(asks);
    expect(asks[0].request).not.toHaveProperty("reason");
    expect(asks[0].request).toMatchObject({
      toolCallId: "t1",
      review: {
        kind: "commit",
        message: "first",
        files: [{ path: "a.txt", status: "A", added: 1, removed: 0 }],
      },
    });
    asks[0].answer(true);
    const result = await done;
    expect(result.content[0].text).toContain("first");
    expect(result.details).toMatchObject({
      range: expect.stringMatching(/\^!$/),
    });
  });

  it("shows what a merge brought in, and nothing when HEAD didn't move", async () => {
    const { call } = load();
    const git = (...args: string[]) => execFileSync("git", args, { cwd: repo });
    git("add", ".");
    git("commit", "-qm", "first");
    git("switch", "-qc", "feature");
    await writeFile(join(repo, "b.txt"), "b\n");
    git("add", ".");
    git("commit", "-qm", "add b");
    git("switch", "-q", "main");
    const merged = await call("git", ["merge", "feature"]);
    expect(merged.details).toMatchObject({
      kind: "update",
      files: [{ path: "b.txt", status: "A", added: 1, removed: 0 }],
      commits: [{ subject: "add b" }],
    });
    const again = await call("git", ["merge", "feature"]);
    expect(again.details).toBeUndefined();
  });

  it("doesn't commit when the user denies it", async () => {
    const { asks, call } = load();
    await call("git", ["add", "a.txt"]);
    const done = call("git", ["commit", "-m", "first"]);
    await asked(asks);
    asks[0].answer(false);
    await expect(done).rejects.toThrow(DENIED);
    await expect(call("git", ["log"])).rejects.toThrow(/Exited with code/);
  });

  it("asks for every call in Manual, without a reason", async () => {
    await approvalSettings("mode = 'manual'");
    const { asks, call } = load();
    const done = call("git", ["status"]);
    await asked(asks);
    expect(asks[0].request).toEqual({ toolCallId: "t1" });
    asks[0].answer(true);
    await done;
  });

  it("commits without asking with full access", async () => {
    await approvalSettings("full_access = true");
    const { asks, call } = load();
    await call("git", ["add", "a.txt"]);
    await call("git", ["commit", "-m", "first"]);
    expect(asks).toEqual([]);
    const log = await call("git", ["log", "--oneline", "-1"]);
    expect(log.content[0].text).toContain("first");
  });
});

describe("the gh tool", () => {
  it("asks before changing something on GitHub", async () => {
    const { asks, call } = load();
    const done = call("gh", ["pr", "merge", "3"]);
    await asked(asks);
    expect(asks[0].request).toEqual({
      toolCallId: "t1",
      reason: "Changes something on GitHub",
    });
    asks[0].answer(false);
    await expect(done).rejects.toThrow(DENIED);
  });

  it("doesn't ask before changing something on GitHub with full access", async () => {
    await approvalSettings("full_access = true");
    const { asks, call } = load();
    await expect(call("gh", ["pr", "merge", "3"])).rejects.toThrow();
    expect(asks).toEqual([]);
  });
});

describe("a task's conversation", () => {
  const git = (...args: string[]) => execFileSync("git", args, { cwd: repo });
  async function withRemote() {
    git("add", ".");
    git("commit", "-qm", "first");
    git("switch", "-qc", "feat/x");
    git("init", "-q", "--bare", "-b", "main", join(home, "remote.git"));
    git("remote", "add", "origin", join(home, "remote.git"));
  }

  it("commits and pushes its own branch without asking", async () => {
    await withRemote();
    const { asks, call } = load(mine);
    await writeFile(join(repo, "b.txt"), "b\n");
    await call("git", ["add", "b.txt"]);
    const commit = await call("git", ["commit", "-m", "second"]);
    const push = await call("git", ["push", "-u", "origin", "feat/x"]);
    expect(asks).toEqual([]);
    // Reviewed before running, so the rows still show what they changed.
    expect(commit.details).toMatchObject({
      kind: "commit",
      files: [{ path: "b.txt", status: "A" }],
    });
    expect(push.details).toMatchObject({
      kind: "push",
      commits: expect.arrayContaining([
        expect.objectContaining({ subject: "second" }),
      ]),
    });
    expect(git("ls-remote", "origin", "feat/x").toString()).toContain(
      "refs/heads/feat/x",
    );
  });

  it("judges a push by the branch of the repository -C names", async () => {
    await withRemote();
    const { asks, call } = load(mine);
    // From the parent folder, which isn't a repository and has no branch.
    await call("git", ["-C", "app", "push", "-u", "origin", "feat/x"], home);
    expect(asks).toEqual([]);
  });

  it("still asks to push the default branch", async () => {
    await withRemote();
    const { asks, call } = load(mine);
    const done = call("git", ["push", "origin", "HEAD:main"]);
    await asked(asks);
    asks[0].answer(false);
    await expect(done).rejects.toThrow(DENIED);
  });

  it("commits and pushes in one call, asking once", async () => {
    await withRemote();
    const { asks, call } = load();
    const done = call(
      "git",
      ["commit", "--allow-empty", "-m", "x"],
      repo,
      true,
    );
    await asked(asks);
    expect(asks[0].request).toMatchObject({
      review: { kind: "commit", push: "feat/x" },
    });
    asks[0].answer(true);
    const result = await done;
    expect(result.details).toMatchObject({ kind: "commit", push: "feat/x" });
    expect(git("ls-remote", "origin", "feat/x").toString()).toContain(
      "refs/heads/feat/x",
    );
  });

  it("commits and pushes its own branch in one call without asking", async () => {
    await withRemote();
    const { asks, call } = load(mine);
    await call("git", ["commit", "--allow-empty", "-m", "x"], repo, true);
    expect(asks).toEqual([]);
    expect(git("ls-remote", "origin", "feat/x").toString()).toContain(
      "refs/heads/feat/x",
    );
  });

  it("refuses push: true off a branch or without a commit, before running", async () => {
    await withRemote();
    const { asks, call } = load();
    await expect(call("git", ["status"], repo, true)).rejects.toThrow(
      "only with a commit",
    );
    await expect(
      call("git", ["--git-dir", ".git", "commit", "-m", "x"], repo, true),
    ).rejects.toThrow("no git options");
    git("switch", "-q", "--detach");
    await expect(
      call("git", ["commit", "--allow-empty", "-m", "x"], repo, true),
    ).rejects.toThrow("isn't on a branch");
    expect(asks).toEqual([]);
  });

  it("reports the commit when its push fails", async () => {
    await withRemote();
    git("remote", "set-url", "origin", join(home, "missing.git"));
    const { asks, call } = load(mine);
    await expect(
      call("git", ["commit", "--allow-empty", "-m", "x"], repo, true),
    ).rejects.toThrow("Committed, but the push failed");
    expect(asks).toEqual([]);
  });

  it("asks for a commit and a push without a task", async () => {
    await withRemote();
    const { asks, call } = load();
    const done = call("git", ["commit", "--allow-empty", "-m", "x"]);
    await asked(asks);
    asks[0].answer(false);
    await expect(done).rejects.toThrow(DENIED);
  });

  it("asks for a commit in a conversation the user follows", async () => {
    await withRemote();
    const { asks, call } = load({ ...mine, interactive: true });
    const done = call("git", ["commit", "--allow-empty", "-m", "x"]);
    await asked(asks);
    asks[0].answer(false);
    await expect(done).rejects.toThrow(DENIED);
  });

  it("asks before gh pr create, then reports the pull request", async () => {
    const bin = join(home, "bin");
    await mkdir(bin);
    await writeFile(
      join(bin, "gh"),
      "#!/bin/sh\necho https://github.com/a/b/pull/41\n",
      { mode: 0o755 },
    );
    vi.stubEnv("PATH", `${bin}:${process.env.PATH}`);
    const { asks, updates, call } = load(mine);
    const done = call("gh", ["pr", "create", "--fill"]);
    await asked(asks);
    asks[0].answer(true);
    const result = await done;
    expect(result.content[0].text).toContain("/pull/41");
    expect(updates).toEqual([{ pr: "https://github.com/a/b/pull/41" }]);
  });

  it("records a declined pull request on the task and tells the agent to stop", async () => {
    const { asks, updates, call } = load(mine);
    const done = call("gh", ["pr", "create", "--fill"]);
    await asked(asks);
    asks[0].declined!();
    asks[0].answer(false);
    await expect(done).rejects.toThrow(PR_DECLINED);
    expect(updates).toEqual([{ declined: true }]);
  });

  it("denies a pull request plainly in a conversation the user follows", async () => {
    const { asks, updates, call } = load({ ...mine, interactive: true });
    const done = call("gh", ["pr", "create", "--fill"]);
    await asked(asks);
    asks[0].declined!();
    asks[0].answer(false);
    await expect(done).rejects.toThrow(DENIED);
    expect(updates).toEqual([]);
  });

  it("doesn't count a stop or close as declining the pull request", async () => {
    const { asks, updates, call } = load(mine);
    const done = call("gh", ["pr", "create", "--fill"]);
    await asked(asks);
    asks[0].answer(false);
    await expect(done).rejects.toThrow(DENIED);
    expect(updates).toEqual([]);
  });

  it("denies a pull request plainly without a task", async () => {
    const { asks, call } = load();
    const done = call("gh", ["pr", "create", "--fill"]);
    await asked(asks);
    asks[0].declined!();
    await expect(done).rejects.toThrow(DENIED);
  });

  it("doesn't report a pull request without a task", async () => {
    const bin = join(home, "bin");
    await mkdir(bin);
    await writeFile(join(bin, "gh"), "#!/bin/sh\necho https://x/pull/1\n", {
      mode: 0o755,
    });
    vi.stubEnv("PATH", `${bin}:${process.env.PATH}`);
    const { asks, updates, call } = load();
    const done = call("gh", ["pr", "create"]);
    await asked(asks);
    asks[0].answer(true);
    await done;
    expect(updates).toEqual([]);
  });
});

describe("delivers", () => {
  it("spots calls that put the agent's work on the remote", () => {
    expect(delivers("git", ["push", "-u", "origin", "fix/x"])).toBe(true);
    expect(delivers("git", ["-C", "sub", "push"])).toBe(true);
    expect(delivers("gh", ["pr", "merge", "3", "--merge"])).toBe(true);
    expect(delivers("git", ["commit", "-m", "x"])).toBe(false);
    expect(delivers("gh", ["pr", "create"])).toBe(false);
  });
});

describe("git and gh in bash", () => {
  it("sends commands that need credentials or review to the tools", async () => {
    const { bash } = load();
    const blocked = { block: true, reason: USE_TOOLS };
    expect(await bash("cd server && git push -u origin x")).toEqual(blocked);
    expect(await bash("gh pr view 3 --comments")).toEqual(blocked);
    expect(await bash("git status && git diff")).toBeUndefined();
    expect(await bash('echo "git push"')).toBeUndefined();
  });

  it("spots them without the parser too", () => {
    expect(needsTools([["git", "-C", "x", "commit"]])).toBe(true);
    expect(needsTools([["git", "log"]])).toBe(false);
  });
});

describe("run", () => {
  it("reports a program that isn't installed", async () => {
    await expect(
      run("no-such-program-here", [], { cwd: repo }),
    ).rejects.toThrow("isn't installed");
  });

  it("says why a run failed", () => {
    expect(resultText({ output: "", code: 0 })).toBe("(no output)");
    expect(resultText({ output: "bad\n", code: 2 })).toBe(
      "bad\n\nExited with code 2",
    );
    expect(resultText({ output: "", code: null })).toBe(
      "(no output)\n\nStopped",
    );
  });
});
