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

function waitTool() {
  let tool: ToolDefinition | undefined;
  bashWait({
    registerTool: (t: ToolDefinition) => (tool = t),
  } as unknown as ExtensionAPI);
  return (pid: number) =>
    tool!.execute("t1", { pid } as never, undefined, undefined, ctx);
}

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
    expect(textOf(await waitTool()(b.pid))).toContain(`when ${b.pid} exits`);
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
