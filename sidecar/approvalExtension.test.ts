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
  approvalMode,
  realPath,
  type ApprovalAsk,
} from "./approvalExtension.ts";
import { APP_NAME } from "../src/lib/app.ts";

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

type Handler = (event: object, ctx: object) => Promise<unknown>;

/** Loads the extension with a real event bus; `asks` collects its questions. */
function load() {
  const events = createEventBus();
  let handler: Handler = async () => undefined;
  approval({
    on: (_name: string, h: Handler) => (handler = h),
    events,
  } as unknown as ExtensionAPI);
  const asks: ApprovalAsk[] = [];
  events.on(APPROVAL_EVENT, (data) => void asks.push(data as ApprovalAsk));
  const call = (
    toolName: string,
    input: Record<string, unknown>,
    signal?: AbortSignal,
  ) =>
    handler(
      { type: "tool_call", toolCallId: "t1", toolName, input },
      { cwd, signal },
    );
  return { asks, call };
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
