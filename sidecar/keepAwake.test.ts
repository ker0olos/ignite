import { EventEmitter } from "node:events";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChildProcess } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import { createKeepAwake, keepAwakeEnabled } from "./keepAwake.ts";

const fakeChild = () =>
  Object.assign(new EventEmitter(), {
    kill: vi.fn(),
  }) as unknown as ChildProcess;

describe("keepAwakeEnabled", () => {
  it("is on without a settings file and off when the setting says so", async () => {
    const dir = await mkdtemp(join(tmpdir(), "keep-awake-"));
    const file = join(dir, "settings.toml");
    expect(await keepAwakeEnabled(file)).toBe(true);
    await writeFile(file, "[power]\nkeep_awake = false\n");
    expect(await keepAwakeEnabled(file)).toBe(false);
    await writeFile(file, "[power]\nkeep_awake = true\n");
    expect(await keepAwakeEnabled(file)).toBe(true);
  });
});

describe("createKeepAwake", () => {
  it("holds one caffeinate while working and ends it when not", async () => {
    const child = fakeChild();
    const run = vi.fn(() => child);
    const set = createKeepAwake(async () => true, run, "darwin");
    await set(true);
    await set(true);
    expect(run).toHaveBeenCalledTimes(1);
    await set(false);
    expect(child.kill).toHaveBeenCalledTimes(1);
    await set(false);
    expect(child.kill).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the setting is off or off macOS", async () => {
    const run = vi.fn(fakeChild);
    await createKeepAwake(async () => false, run, "darwin")(true);
    await createKeepAwake(async () => true, run, "linux")(true);
    expect(run).not.toHaveBeenCalled();
  });

  it("uses the latest state when setting reads finish out of order", async () => {
    const child = fakeChild();
    const run = vi.fn(() => child);
    let release!: () => void;
    const slow = new Promise<boolean>((r) => (release = () => r(true)));
    const reads = [slow, Promise.resolve(true)];
    const set = createKeepAwake(() => reads.shift()!, run, "darwin");
    const first = set(true);
    await set(false);
    release();
    await first;
    expect(run).not.toHaveBeenCalled();
  });

  it("starts again after caffeinate fails to spawn", async () => {
    const child = fakeChild();
    const run = vi.fn(() => child);
    const set = createKeepAwake(async () => true, run, "darwin");
    await set(true);
    child.emit("error", new Error("ENOENT"));
    await set(true);
    expect(run).toHaveBeenCalledTimes(2);
  });
});
