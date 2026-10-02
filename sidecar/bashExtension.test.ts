// @vitest-environment node
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import type {
  ExtensionAPI,
  ExtensionContext,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  backgroundOf,
  forgetBackground,
  STARTUP_MS,
} from "./backgroundBash.ts";
import bash, { COMMAND_GUIDANCE, runBackground } from "./bashExtension.ts";

const cwd = realpathSync(tmpdir());
const ctx = {
  cwd,
  sessionManager: { getSessionId: () => "s1", getSessionFile: () => undefined },
} as unknown as ExtensionContext;

function load() {
  const tools = new Map<string, ToolDefinition>();
  const handlers = new Map<string, (event: object, ctx?: object) => void>();
  bash({
    registerTool: (tool: ToolDefinition) => tools.set(tool.name, tool),
    on: (name: string, h: (event: object, ctx?: object) => void) =>
      handlers.set(name, h),
  } as unknown as ExtensionAPI);
  const run = (name: string, params: object) =>
    tools.get(name)!.execute("t1", params as never, undefined, undefined, ctx);
  return { tools, handlers, run };
}

const textOf = (result: { content: object[] }) =>
  (result.content[0] as { text: string }).text;

afterEach(() => {
  vi.useRealTimers();
  forgetBackground("s1");
});

describe.runIf(process.platform !== "win32")("bash extension", () => {
  it("keeps bash's own parameters and adds background", () => {
    const params = load().tools.get("bash")!.parameters as {
      properties: object;
    };
    expect(Object.keys(params.properties)).toEqual([
      "command",
      "timeout",
      "background",
    ]);
  });

  it("tells the agent to run commands itself", () => {
    const start = load().handlers.get("before_agent_start")!;
    expect(start({ systemPrompt: "base" })).toEqual({
      systemPrompt: `base\n\n${COMMAND_GUIDANCE}`,
    });
  });

  it("runs commands as pi's bash does without it", async () => {
    const { run } = load();
    expect(textOf(await run("bash", { command: "pwd" }))).toBe(`${cwd}\n`);
    await expect(run("bash", { command: "exit 2" })).rejects.toThrow(
      "Command exited with code 2",
    );
  });

  it("says where a background command went, and stops it", async () => {
    const loaded = load();
    const { run } = loaded;
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    // Its output so far is backgroundBash.test.ts's to check.
    // The sandbox rewrites the command after this extension sees the call.
    const { handlers } = loaded;
    const input = { command: "sleep 30", background: true };
    handlers.get("tool_call")!({ toolName: "bash", toolCallId: "t1", input });
    input.command = "sleep 30 # sandboxed";
    const done = run("bash", input);
    await vi.advanceTimersByTimeAsync(STARTUP_MS);
    const result = await done;
    const [started] = backgroundOf("s1");
    expect(started.command).toBe("sleep 30");
    expect(textOf(result)).toBe(
      `(no output)\n\nStill running in the background as pid ${started.pid}. ` +
        `Its output goes to ${started.log}; read it with tail, and end it with bash_stop.`,
    );
    expect(result.details).toMatchObject({ background: started });
    expect(textOf(await run("bash_stop", { pid: started.pid }))).toBe(
      `Stopped ${started.pid}.`,
    );
    vi.useRealTimers();
    await vi.waitFor(() => expect(started.running).toBe(false));
    await expect(run("bash_stop", { pid: started.pid })).rejects.toThrow(
      `No background command ${started.pid} here. Running: none.`,
    );
  });

  it("returns a background command that ended in time as is", async () => {
    const done = await runBackground("t", { command: "echo quick" }, ctx);
    expect(textOf(done)).toBe("quick\n");
  });

  it("stops the conversation's commands when it ends, not on a reload", async () => {
    const { handlers } = load();
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const done = runBackground("t", { command: "sleep 30" }, ctx);
    await vi.advanceTimersByTimeAsync(STARTUP_MS);
    await done;
    const shutdown = handlers.get("session_shutdown")!;
    shutdown({ reason: "reload" }, ctx);
    expect(backgroundOf("s1")).toHaveLength(1);
    shutdown({ reason: "quit" }, ctx);
    expect(backgroundOf("s1")).toEqual([]);
  });
});
