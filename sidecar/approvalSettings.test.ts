// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APP_NAME } from "../src/lib/app.ts";

const started = vi.hoisted(() => ({ unix: 0, windows: 0, fail: false }));
vi.mock("./sandbox.ts", () => ({
  createSandbox: async () => (started.unix++, { kind: "unix" }),
}));
vi.mock("./windowsSandbox.ts", () => ({
  createWindowsSandbox: async () => {
    started.windows++;
    if (started.fail) throw new Error("its one-time setup was declined");
    return { kind: "windows" };
  },
}));

let home: string;
const platform = process.platform;
beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "approval-settings-"));
  vi.stubEnv("HOME", home);
  vi.stubEnv("USERPROFILE", home);
  started.unix = started.windows = 0;
  started.fail = false;
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
  vi.resetModules();
});
afterEach(async () => {
  Object.defineProperty(process, "platform", { value: platform });
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await rm(home, { recursive: true, force: true });
});

const settings = async (toml: string) => {
  await mkdir(join(home, `.${APP_NAME}`), { recursive: true });
  await writeFile(join(home, `.${APP_NAME}`, "settings.toml"), toml);
};

describe("currentSandbox", () => {
  it("starts the OS sandbox at once on macOS and Linux", async () => {
    Object.defineProperty(process, "platform", { value: "darwin" });
    const { currentSandbox } = await import("./approvalSettings.ts");
    expect(started.unix).toBe(1);
    expect(await currentSandbox()).toEqual({ kind: "unix" });
  });

  it("on Windows, starts it only once windows_sandbox is on, then keeps it", async () => {
    Object.defineProperty(process, "platform", { value: "win32" });
    const { currentSandbox } = await import("./approvalSettings.ts");
    expect(await currentSandbox()).toBeUndefined();
    expect(started.windows).toBe(0);
    await settings("[approval]\nwindows_sandbox = true\n");
    expect(await currentSandbox()).toEqual({ kind: "windows" });
    expect(await currentSandbox()).toEqual({ kind: "windows" });
    expect(started.windows).toBe(1);
    await settings("[approval]\nwindows_sandbox = false\n");
    expect(await currentSandbox()).toBeUndefined();
    expect(started.unix).toBe(0);
  });

  it("on Windows, tries a failed setup again once the setting is turned off and on", async () => {
    Object.defineProperty(process, "platform", { value: "win32" });
    const { currentSandbox } = await import("./approvalSettings.ts");
    started.fail = true;
    await settings("[approval]\nwindows_sandbox = true\n");
    expect(await currentSandbox()).toBeUndefined();
    expect(await currentSandbox()).toBeUndefined();
    expect(started.windows).toBe(1);
    await settings("[approval]\nwindows_sandbox = false\n");
    await currentSandbox();
    started.fail = false;
    await settings("[approval]\nwindows_sandbox = true\n");
    expect(await currentSandbox()).toEqual({ kind: "windows" });
    expect(started.windows).toBe(2);
  });
});

describe("sandboxing", () => {
  it("on Windows follows the setting without starting the sandbox", async () => {
    Object.defineProperty(process, "platform", { value: "win32" });
    const { sandboxing } = await import("./approvalSettings.ts");
    expect(await sandboxing()).toBe(false);
    await settings("[approval]\nwindows_sandbox = true\n");
    expect(await sandboxing()).toBe(true);
    expect(started.windows).toBe(0);
  });

  it("elsewhere is whether the sandbox started", async () => {
    Object.defineProperty(process, "platform", { value: "linux" });
    const { sandboxing } = await import("./approvalSettings.ts");
    expect(await sandboxing()).toBe(true);
  });
});
