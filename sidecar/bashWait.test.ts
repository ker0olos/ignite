// @vitest-environment node
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  ExtensionAPI,
  ExtensionToolContext,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  backgroundOf,
  cancelWaits,
  forgetBackground,
  onBackgroundChange,
  STARTUP_MS,
  stopBackground,
  type Background,
} from "./backgroundBash.ts";
import { runBackground } from "./bashExtension.ts";
import bashWait, { exitedText } from "./bashWait.ts";
import { takeNotes } from "./forks.ts";
import { wakeWaiting } from "./hostWait.ts";
import type { Agent, HostContext } from "./hostTypes.ts";

const ctx = {
  cwd: realpathSync(tmpdir()),
  sessionManager: { getSessionId: () => "w1", getSessionFile: () => undefined },
} as unknown as ExtensionToolContext;

function tool() {
  let registered: ToolDefinition | undefined;
  bashWait({
    registerTool: (t: ToolDefinition) => (registered = t),
  } as unknown as ExtensionAPI);
  return registered!;
}

const waitTool =
  () =>
  (...pids: number[]) =>
    tool().execute("t1", { pids } as never, undefined, undefined, ctx);

// A host whose one conversation, w1, takes the wakes; `forked` adds its open fork.
function host(forked = false) {
  const sendCustomMessage = vi.fn(async () => {});
  const agents = new Map<string, Partial<Agent>>([
    ["w1", { id: "w1", session: { sendCustomMessage } as never }],
  ]);
  if (forked) agents.set("f1", { id: "f1", forkOf: "w1" });
  const hostCtx = { agents } as unknown as HostContext;
  return { sendCustomMessage, wake: () => wakeWaiting(hostCtx) };
}

async function start(command: string) {
  vi.useFakeTimers({ toFake: ["setTimeout"] });
  const done = runBackground("t", { command }, ctx);
  await vi.advanceTimersByTimeAsync(STARTUP_MS);
  await done;
  vi.useRealTimers();
  return backgroundOf("w1").at(-1)!;
}

const textOf = (result: { content: object[] }) =>
  (result.content[0] as { text: string }).text;

let agentDir: string;
beforeEach(() => {
  agentDir = mkdtempSync(join(tmpdir(), "bash-wait-"));
  process.env.PI_CODING_AGENT_DIR = agentDir;
});

afterEach(() => {
  vi.useRealTimers();
  forgetBackground("w1");
  delete process.env.PI_CODING_AGENT_DIR;
  rmSync(agentDir, { recursive: true, force: true });
});

describe.runIf(process.platform !== "win32")("bash_wait", () => {
  it("wakes the conversation with the exit code and all of its output", async () => {
    const { sendCustomMessage, wake } = host();
    const b = await start("sleep 0.3; echo finished; exit 3");
    expect(textOf(await waitTool()(b.pid))).toContain(
      `once ${b.pid} has exited`,
    );
    await vi.waitFor(() => expect(b.running).toBe(false));
    wake();
    await vi.waitFor(() => expect(sendCustomMessage).toHaveBeenCalledTimes(1));
    const [message, options] = sendCustomMessage.mock.calls[0] as never as [
      { content: string },
      object,
    ];
    expect(message.content).toContain(`(pid ${b.pid}) exited with code 3`);
    expect(message.content).toContain("finished");
    expect(options).toEqual({ triggerTurn: true, deliverAs: "followUp" });
    wake();
    expect(sendCustomMessage).toHaveBeenCalledTimes(1);
  });

  it("wakes once, after every command it waits on has exited", async () => {
    const { sendCustomMessage, wake } = host();
    const fast = await start("sleep 0.1; echo fast");
    const slow = await start("sleep 0.6; echo slow");
    expect(textOf(await waitTool()(fast.pid, slow.pid))).toContain(
      "have all exited",
    );
    await vi.waitFor(() => expect(fast.running).toBe(false));
    wake();
    expect(sendCustomMessage).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(slow.running).toBe(false));
    wake();
    await vi.waitFor(() => expect(sendCustomMessage).toHaveBeenCalledTimes(1));
    const [message] = sendCustomMessage.mock.calls[0] as never as [
      { content: string },
    ];
    expect(message.content).toContain("fast");
    expect(message.content).toContain("slow");
  });

  it("still wakes for the rest once one it waits on is stopped", async () => {
    const { sendCustomMessage, wake } = host();
    const stopped = await start("sleep 30");
    const left = await start("sleep 0.3; echo left");
    await waitTool()(stopped.pid, left.pid);
    stopBackground(stopped.pid, "w1");
    await vi.waitFor(() => expect(left.running).toBe(false));
    await vi.waitFor(() => expect(stopped.running).toBe(false));
    wake();
    await vi.waitFor(() => expect(sendCustomMessage).toHaveBeenCalledTimes(1));
    const [message] = sendCustomMessage.mock.calls[0] as never as [
      { content: string },
    ];
    expect(message.content).toContain("left");
    expect(message.content).not.toContain(`pid ${stopped.pid}`);
  });

  it("wakes at once when a stop leaves its call with only exited commands", async () => {
    const { sendCustomMessage, wake } = host();
    const stubborn = await start('trap "" TERM; sleep 30');
    const done = await start("sleep 0.1; echo done");
    await waitTool()(stubborn.pid, done.pid);
    await vi.waitFor(() => expect(done.running).toBe(false));
    wake();
    const unsubscribe = onBackgroundChange(wake);
    stopBackground(stubborn.pid, "w1", 10_000);
    unsubscribe();
    await vi.waitFor(() => expect(sendCustomMessage).toHaveBeenCalledTimes(1));
    expect(stubborn.running).toBe(true);
  });

  it("folds an earlier call into a later one that takes its last running command", async () => {
    const { sendCustomMessage, wake } = host();
    const done = await start("sleep 0.1; echo done");
    const running = await start("sleep 0.5; echo running");
    await waitTool()(done.pid, running.pid);
    await vi.waitFor(() => expect(done.running).toBe(false));
    wake();
    await waitTool()(running.pid);
    wake();
    expect(sendCustomMessage).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(running.running).toBe(false));
    wake();
    await vi.waitFor(() => expect(sendCustomMessage).toHaveBeenCalledTimes(1));
    const [message] = sendCustomMessage.mock.calls[0] as never as [
      { content: string },
    ];
    expect(message.content).toContain(`(pid ${done.pid})`);
    expect(message.content).toContain(`(pid ${running.pid})`);
  });

  it("doesn't report again a command it already answered for", async () => {
    const { sendCustomMessage, wake } = host();
    const done = await start("sleep 0.1; echo done");
    const running = await start("sleep 0.5; echo running");
    await waitTool()(done.pid, running.pid);
    await vi.waitFor(() => expect(done.running).toBe(false));
    expect(textOf(await waitTool()(done.pid))).toContain(`(pid ${done.pid})`);
    await vi.waitFor(() => expect(running.running).toBe(false));
    wake();
    await vi.waitFor(() => expect(sendCustomMessage).toHaveBeenCalledTimes(1));
    const [message] = sendCustomMessage.mock.calls[0] as never as [
      { content: string },
    ];
    expect(message.content).not.toContain(`(pid ${done.pid})`);
  });

  it("takes a single pid as older calls wrote it", async () => {
    const b = await start("sleep 0.1");
    await vi.waitFor(() => expect(b.running).toBe(false));
    const result = await tool().execute(
      "t1",
      { pid: b.pid } as never,
      undefined,
      undefined,
      ctx,
    );
    expect(textOf(result)).toContain(`(pid ${b.pid}) exited with code 0`);
    await expect(
      tool().execute("t1", {} as never, undefined, undefined, ctx),
    ).rejects.toThrow("Give the pids");
  });

  it("answers at once for a command that already exited", async () => {
    const b = await start("sleep 0.1");
    await vi.waitFor(() => expect(b.running).toBe(false));
    expect(textOf(await waitTool()(b.pid))).toContain("exited with code 0");
    expect(b.wake).toBeFalsy();
  });

  it("refuses a pid the conversation didn't start", async () => {
    await expect(waitTool()(1)).rejects.toThrow("No background command 1");
  });

  it("doesn't wake for a command stopped, or a conversation stopped", async () => {
    const { sendCustomMessage, wake } = host();
    const stopped = await start("sleep 30");
    const left = await start("sleep 0.3");
    await waitTool()(stopped.pid);
    await waitTool()(left.pid);
    stopBackground(stopped.pid, "w1");
    cancelWaits("w1");
    await vi.waitFor(() => expect(left.running).toBe(false));
    await vi.waitFor(() => expect(stopped.running).toBe(false));
    wake();
    expect(sendCustomMessage).not.toHaveBeenCalled();
  });

  it("keeps the exit as a note while the conversation waits on its fork", async () => {
    const { sendCustomMessage, wake } = host(true);
    const b = await start("sleep 0.2; echo forked");
    await waitTool()(b.pid);
    await vi.waitFor(() => expect(b.running).toBe(false));
    wake();
    await vi.waitFor(() => expect(takeNotes("w1")).toHaveLength(1));
    expect(sendCustomMessage).not.toHaveBeenCalled();
  });
});

describe("exitedText", () => {
  const dir = realpathSync(tmpdir());
  const entry = (log: string, exitCode?: number): Background => ({
    pid: 7,
    session: "w1",
    command: "make",
    log,
    raw: log,
    running: false,
    exitCode,
  });

  it("starts a long log's end at a line", async () => {
    const log = join(dir, `bash-wait-${process.pid}.log`);
    writeFileSync(log, `${"x".repeat(5000)}\nlast line\n`);
    const text = await exitedText(entry(log, 0));
    expect(text).toMatch(/it ends:\n\nlast line$/);
    rmSync(log);
  });

  it("says when a killed command's log is gone", async () => {
    expect(await exitedText(entry(join(dir, "missing.log")))).toBe(
      `Background command \`make\` (pid 7) was killed. Its full output is in ${join(dir, "missing.log")}; it couldn't be read.`,
    );
  });
});
