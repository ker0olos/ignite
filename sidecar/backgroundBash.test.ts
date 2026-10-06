// @vitest-environment node
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  backgroundOf,
  backgroundOperations,
  backgroundOutput,
  forgetBackground,
  onBackgroundChange,
  stopBackground,
  type Background,
} from "./backgroundBash.ts";

const cwd = tmpdir();
const SESSION = "s1";
const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const until = async (check: () => boolean | Promise<boolean>) => {
  for (let i = 0; i < 200 && !(await check()); i++) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

// Long enough for a loaded machine to start a shell; commands meant to outlive it sleep longer.
/** Runs `command` with a startup window; what it printed meanwhile, and what it left running. */
async function start(
  command: string,
  signal?: AbortSignal,
  session = SESSION,
  window = 2000,
) {
  let started: Background | undefined;
  const chunks: string[] = [];
  const ops = backgroundOperations(
    { session, command: `as written: ${command}` },
    (b) => (started = b),
    window,
  );
  const { exitCode } = await ops.exec(command, cwd, {
    onData: (data) => chunks.push(data.toString()),
    signal,
    env: process.env,
  });
  return { exitCode, output: chunks.join(""), started };
}

afterEach(() => {
  forgetBackground(SESSION);
  forgetBackground("s2");
});

describe.runIf(process.platform !== "win32")("backgroundOperations", () => {
  it("returns a command that ends in time like any other", async () => {
    expect(await start("echo done; exit 3")).toEqual({
      exitCode: 3,
      output: "done\n",
      started: undefined,
    });
    expect(backgroundOf(SESSION)).toEqual([]);
  });

  it("leaves a long command running, its later output in the log", async () => {
    const { exitCode, output, started } = await start(
      "echo up; sleep 3; echo later; sleep 30",
    );
    expect(exitCode).toBe(0);
    expect(output).toBe("up\n");
    expect(backgroundOf(SESSION)).toEqual([started]);
    expect(started).toMatchObject({
      session: SESSION,
      command: "as written: echo up; sleep 3; echo later; sleep 30",
      running: true,
    });
    await until(async () =>
      (await readFile(started!.log, "utf8")).includes("later"),
    );
    expect(await backgroundOutput(started!.pid, SESSION)).toEqual({
      command: started!.command,
      running: true,
      output: "up\r\nlater\r\n",
      truncated: false,
    });
  });

  it("stops it with everything it started, only from its own conversation", async () => {
    const { started } = await start("sleep 30 & echo $!; wait");
    const { pid } = started!;
    const child = Number((await readFile(started!.log, "utf8")).trim());
    expect(stopBackground(pid, "s2")).toBe(false);
    await expect(backgroundOutput(pid, "s2")).rejects.toThrow(
      `No background command ${pid}`,
    );
    expect(stopBackground(pid, SESSION)).toBe(true);
    // Running until it has actually exited.
    expect(started!.running).toBe(true);
    await until(() => !started!.running && !alive(child));
    expect([alive(pid), alive(child)]).toEqual([false, false]);
    expect(stopBackground(pid, SESSION)).toBe(false);
  });

  it("kills one that ignores being asked to stop", async () => {
    const { started } = await start(
      "trap '' TERM; echo ready; sleep 30 & wait",
    );
    await until(async () =>
      (await readFile(started!.log, "utf8")).includes("ready"),
    );
    expect(stopBackground(started!.pid, SESSION, 200)).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(alive(started!.pid)).toBe(true);
    await until(() => !started!.running);
    expect(alive(started!.pid)).toBe(false);
  });

  it("runs in a terminal: colors for the app, text for the agent", async () => {
    const { output, started } = await start(
      "[ -t 1 ] && printf '\\033[31mtty\\033[0m\\n'; sleep 0.5; echo later; sleep 30",
    );
    expect(output).toBe("tty\nlater\n");
    expect(await readFile(started!.log, "utf8")).toBe("tty\nlater\n");
    expect(await readFile(started!.raw, "utf8")).toBe(
      "\x1b[31mtty\x1b[0m\r\nlater\r\n",
    );
  });

  it("hands the agent a last line that has no newline yet", async () => {
    const { output } = await start("printf 'ready> '; sleep 30");
    expect(output).toBe("ready>");
  });

  it("shows the app the end of a long log from a line's start", async () => {
    const { started } = await start(
      "i=0; while [ $i -lt 1200 ]; do printf '\\033[32m%060d\\033[0m\\n' $i; i=$((i+1)); done; sleep 30",
    );
    await until(
      async () => (await backgroundOutput(started!.pid, SESSION)).truncated,
    );
    const { output } = await backgroundOutput(started!.pid, SESSION);
    expect(output.startsWith("\x1b[32m")).toBe(true);
  });

  it("never starts a command whose run was already stopped", async () => {
    const stop = new AbortController();
    stop.abort();
    await expect(start("sleep 30", stop.signal)).rejects.toThrow("aborted");
    expect(backgroundOf(SESSION)).toEqual([]);
  });

  it("writes each run to its own log", async () => {
    const one = await start("sleep 30");
    const two = await start("sleep 30");
    expect(one.started!.log).not.toBe(two.started!.log);
  });

  it("keeps one that ended on its own, with its exit code", async () => {
    const { started } = await start("sleep 3; exit 4");
    await until(() => !started!.running);
    expect(backgroundOf(SESSION)).toMatchObject([
      { running: false, exitCode: 4 },
    ]);
    expect(stopBackground(started!.pid, SESSION)).toBe(false);
  });

  it("tells listeners when one starts and ends", async () => {
    const heard = vi.fn();
    const off = onBackgroundChange(heard);
    try {
      const { started } = await start("sleep 3");
      expect(heard).toHaveBeenCalledTimes(1);
      await until(() => !started!.running);
      expect(heard).toHaveBeenCalledTimes(2);
    } finally {
      off();
    }
  });

  it("forgets a conversation's, stopping those still running", async () => {
    const { started } = await start("sleep 30");
    await start("sleep 30", undefined, "s2");
    forgetBackground(SESSION);
    expect(backgroundOf(SESSION)).toEqual([]);
    expect(backgroundOf("s2")).toHaveLength(1);
    await until(() => !alive(started!.pid));
    expect(alive(started!.pid)).toBe(false);
  });

  it("kills the command when the run is stopped while it starts", async () => {
    const stop = new AbortController();
    setTimeout(() => stop.abort(), 50);
    await expect(start("sleep 30", stop.signal)).rejects.toThrow("aborted");
    expect(backgroundOf(SESSION)).toEqual([]);
  });

  it("kills one that ignores being stopped while it starts", async () => {
    const stop = new AbortController();
    setTimeout(() => stop.abort(), 50);
    await expect(
      start("trap '' TERM; sleep 30 & wait", stop.signal),
    ).rejects.toThrow("aborted");
  }, 10_000);
});
