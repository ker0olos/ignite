// @vitest-environment node
import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createEventBus,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import approval, {
  APPROVAL_EVENT,
  DENIED,
  RETRY_HINT,
  approvalMode,
  realPath,
  type ApprovalAsk,
} from "./approvalExtension.ts";
import { APP_NAME } from "../src/lib/app.ts";
import { WINDOWS_SHELL } from "../src/lib/approvalPolicy.ts";

// A fake sandbox: wrapping marks the command, and `violation` is what it
// reports blocking. The real one is tested in sandbox.test.ts.
const fake = vi.hoisted(() => ({ violation: "" }));
vi.mock("./sandbox.ts", async (actual) => ({
  ...(await actual<typeof import("./sandbox.ts")>()),
  createSandbox: async () => ({
    wrap: async (command: string) => `sandboxed ${command}`,
    explain: async (_id: string, output: string) =>
      fake.violation
        ? `${output}\n<sandbox_violations>\nsh(1) deny(1) ${fake.violation}\n</sandbox_violations>`
        : output,
  }),
}));
beforeEach(() => {
  fake.violation = "";
});

let home: string;
let cwd: string;
beforeEach(async () => {
  home = await realpath(await mkdtemp(join(tmpdir(), "approval-")));
  cwd = join(home, "app");
  await mkdir(cwd);
  vi.stubEnv("HOME", home);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(home, { recursive: true, force: true });
});

const settings = (toml: string) =>
  mkdir(join(home, `.${APP_NAME}`), { recursive: true }).then(() =>
    writeFile(join(home, `.${APP_NAME}`, "settings.toml"), toml),
  );

describe("approvalMode", () => {
  it("is Auto without a settings file, a setting, or with a bad one", async () => {
    expect(await approvalMode()).toBe("auto");
    await settings("theme = 'system'\n");
    expect(await approvalMode()).toBe("auto");
    await settings("[approval]\nmode = 'sometimes'\n");
    expect(await approvalMode()).toBe("auto");
    await settings("not toml [");
    expect(await approvalMode()).toBe("auto");
  });

  it("reads Manual from settings.toml", async () => {
    await settings("[approval]\nmode = 'manual'\n");
    expect(await approvalMode()).toBe("manual");
  });
});

describe("realPath", () => {
  it("follows symlinks, as far as the path exists", async () => {
    await symlink(home, join(cwd, "link"));
    expect(await realPath(join(cwd, "link", "new", "file.txt"))).toBe(
      join(home, "new", "file.txt"),
    );
    expect(await realPath(join(cwd, "missing"))).toBe(join(cwd, "missing"));
  });
});

type Handler = (event: object, ctx?: object) => Promise<unknown>;

/**
 * Loads the extension with a real event bus; `asks` collects its questions.
 * `call` returns the handler's result, `input` the call's (maybe rewritten)
 * input, and `result` plays the tool's output back through tool_result.
 */
function load() {
  const events = createEventBus();
  const handlers = new Map<string, Handler>();
  approval({
    on: (name: string, h: Handler) => handlers.set(name, h),
    events,
  } as unknown as ExtensionAPI);
  const asks: ApprovalAsk[] = [];
  events.on(APPROVAL_EVENT, (data) => void asks.push(data as ApprovalAsk));
  let input: Record<string, unknown> = {};
  let id = 0;
  const call = (
    toolName: string,
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ) => {
    input = { ...args };
    const toolCallId = `t${++id}`;
    return handlers.get("tool_call")!(
      { type: "tool_call", toolCallId, toolName, input },
      { cwd, signal },
    );
  };
  const result = (text: string, isError: boolean) =>
    handlers.get("tool_result")!({
      type: "tool_result",
      toolCallId: `t${id}`,
      toolName: "bash",
      input,
      content: [{ type: "text", text }],
      isError,
    });
  return { asks, call, result, input: () => input };
}

describe("tool_call", () => {
  it("lets safe calls run in Auto without asking", async () => {
    const { asks, call } = load();
    expect(await call("bash", { command: "npm test" })).toBeUndefined();
    expect(await call("write", { path: "src/a.ts" })).toBeUndefined();
    expect(asks).toEqual([]);
  });

  it("asks before a dangerous command and runs it once approved", async () => {
    const { asks, call } = load();
    const result = call("bash", { command: "git push --force" });
    await vi.waitFor(() => expect(asks).toHaveLength(1));
    expect(asks[0].request).toEqual({
      toolCallId: "t1",
      reason: "Rewrites or deletes history on the remote",
    });
    asks[0].answer(true);
    expect(await result).toBeUndefined();
  });

  it("runs an approved command as is, outside the sandbox", async () => {
    const { asks, call, input } = load();
    const result = call("bash", { command: "git push --force" });
    await vi.waitFor(() => expect(asks).toHaveLength(1));
    asks[0].answer(true);
    await result;
    expect(input().command).toBe("git push --force");
  });

  it("blocks a denied call with a reason for the model", async () => {
    const { asks, call } = load();
    const result = call("read", { path: "~/.ssh/config" });
    await vi.waitFor(() => expect(asks).toHaveLength(1));
    expect(asks[0].request.reason).toBe("Outside the project: ~/.ssh/config");
    asks[0].answer(false);
    expect(await result).toEqual({ block: true, reason: DENIED });
  });

  it("judges a file by where a symlink in the folder leads", async () => {
    await symlink(home, join(cwd, "escape"));
    const { asks, call } = load();
    void call("edit", { path: "escape/notes.md" });
    await vi.waitFor(() => expect(asks).toHaveLength(1));
    expect(asks[0].request.reason).toBe("Outside the project: ~/notes.md");
  });

  it("asks before every call in Manual", async () => {
    await settings("[approval]\nmode = 'manual'\n");
    const { asks, call } = load();
    const result = call("read", { path: "README.md" });
    await vi.waitFor(() => expect(asks).toHaveLength(1));
    expect(asks[0].request).toEqual({ toolCallId: "t1" });
    asks[0].answer(true);
    expect(await result).toBeUndefined();
  });

  it("lets ask_user through in Manual; its questions wait instead", async () => {
    await settings("[approval]\nmode = 'manual'\n");
    const { asks, call } = load();
    expect(await call("ask_user", { questions: [] })).toBeUndefined();
    expect(asks).toEqual([]);
  });

  it("denies a waiting call when the run is stopped", async () => {
    await settings("[approval]\nmode = 'manual'\n");
    const { asks, call } = load();
    const stop = new AbortController();
    const result = call("bash", { command: "ls" }, stop.signal);
    await vi.waitFor(() => expect(asks).toHaveLength(1));
    stop.abort();
    expect(await result).toEqual({ block: true, reason: DENIED });
  });
});

describe("the sandbox in Auto", () => {
  it("runs shell commands in the sandbox without asking", async () => {
    const { asks, call, input } = load();
    expect(await call("bash", { command: "npm test" })).toBeUndefined();
    expect(input().command).toBe("sandboxed npm test");
    // The sandbox, not a prompt, keeps it inside the folder.
    await call("bash", { command: "cat /etc/hosts" });
    expect(input().command).toBe("sandboxed cat /etc/hosts");
    expect(asks).toEqual([]);
  });

  it("leaves other tools alone", async () => {
    const { call, input } = load();
    await call("write", { path: "src/a.ts" });
    expect(input()).toEqual({ path: "src/a.ts" });
  });

  it("doesn't sandbox in Manual, where every command is approved", async () => {
    await settings("[approval]\nmode = 'manual'\n");
    const { asks, call, input } = load();
    const result = call("bash", { command: "npm test" });
    await vi.waitFor(() => expect(asks).toHaveLength(1));
    asks[0].answer(true);
    await result;
    expect(input().command).toBe("npm test");
  });

  it("tells the model what was blocked, and asks when it retries", async () => {
    const { asks, call, result, input } = load();
    await call("bash", { command: "touch ~/x" });
    fake.violation = "file-write-create /Users/me/x";
    const explained = (await result("Operation not permitted", true)) as {
      content: { text: string }[];
    };
    expect(explained.content[0].text).toContain("file-write-create");
    expect(explained.content[0].text).toContain(RETRY_HINT);

    const retry = call("bash", { command: "touch ~/x" });
    await vi.waitFor(() => expect(asks).toHaveLength(1));
    expect(asks[0].request.reason).toBe(
      "The sandbox stopped it from trying to create /Users/me/x. Run it outside the sandbox?",
    );
    asks[0].answer(true);
    await retry;
    expect(input().command).toBe("touch ~/x");
    // Approved once; the next run is sandboxed again.
    await call("bash", { command: "touch ~/x" });
    expect(input().command).toBe("sandboxed touch ~/x");
  });

  it("sees a block in the output when the sandbox's report is late", async () => {
    const { asks, call, result } = load();
    await call("bash", { command: "touch ~/x" });
    const refused = "touch: /Users/me/x: Operation not permitted";
    const explained = (await result(refused, true)) as {
      content: { text: string }[];
    };
    expect(explained.content[0].text).toBe(`${refused}\n\n${RETRY_HINT}`);
    void call("bash", { command: "touch ~/x" });
    await vi.waitFor(() => expect(asks).toHaveLength(1));
    expect(asks[0].request.reason).toBe(
      `The sandbox blocked it (${refused}). Run it outside the sandbox?`,
    );
  });

  it("leaves other failures alone", async () => {
    const { asks, call, result } = load();
    await call("bash", { command: "npm test" });
    expect(await result("1 test failed", true)).toBeUndefined();
    await call("bash", { command: "npm test" });
    expect(asks).toEqual([]);
  });

  it("ignores what the sandbox logged for a command that succeeded", async () => {
    const { asks, call, result } = load();
    await call("bash", { command: "curl https://registry.npmjs.org" });
    fake.violation = "mach-lookup com.apple.SystemConfiguration.configd";
    expect(await result("200", false)).toBeUndefined();
    await call("bash", { command: "curl https://registry.npmjs.org" });
    expect(asks).toEqual([]);
  });

  it("asks for shell commands on Windows", async () => {
    const platform = Object.getOwnPropertyDescriptor(process, "platform")!;
    Object.defineProperty(process, "platform", { value: "win32" });
    try {
      const { asks, call } = load();
      void call("bash", { command: "npm test" });
      await vi.waitFor(() => expect(asks).toHaveLength(1));
      expect(asks[0].request.reason).toBe(WINDOWS_SHELL);
    } finally {
      Object.defineProperty(process, "platform", platform);
    }
  });

  it("leaves results of calls it didn't sandbox alone", async () => {
    const { result } = load();
    fake.violation = "file-write-create /x";
    expect(await result("failed", true)).toBeUndefined();
  });
});
