import { EventEmitter } from "node:events";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChildProcess } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import { createKeepAwake, keepAwakeFlags } from "./keepAwake.ts";

const fakeChild = () =>
  Object.assign(new EventEmitter(), {
    kill: vi.fn(),
  }) as unknown as ChildProcess;

describe("keepAwakeFlags", () => {
  it("follows the power settings, keeping the system awake by default", async () => {
    const dir = await mkdtemp(join(tmpdir(), "keep-awake-"));
    const file = join(dir, "settings.toml");
    expect(await keepAwakeFlags(file)).toBe("-i");
    await writeFile(file, "[power]\nkeep_awake = false\n");
    expect(await keepAwakeFlags(file)).toBeNull();
    await writeFile(file, "[power]\nkeep_awake = true\n");
    expect(await keepAwakeFlags(file)).toBe("-i");
    await writeFile(file, "[power]\nkeep_screen_awake = true\n");
    expect(await keepAwakeFlags(file)).toBe("-di");
    await writeFile(
      file,
      "[power]\nkeep_awake = false\nkeep_screen_awake = true\n",
    );
    expect(await keepAwakeFlags(file)).toBeNull();
  });
});

describe("createKeepAwake", () => {
  it("holds one caffeinate while working and ends it when not", async () => {
    const child = fakeChild();
    const run = vi.fn(() => child);
    const set = createKeepAwake(async () => "-i", run, "darwin");
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
    await createKeepAwake(async () => null, run, "darwin")(true);
    await createKeepAwake(async () => "-i", run, "linux")(true);
    expect(run).not.toHaveBeenCalled();
  });

  it("restarts caffeinate when the screen setting changes mid-run", async () => {
    const children = [fakeChild(), fakeChild()];
    const run = vi.fn(() => children[run.mock.calls.length - 1]);
    const reads = ["-i", "-di"];
    const set = createKeepAwake(async () => reads.shift()!, run, "darwin");
    await set(true);
    await set(true);
    expect(run.mock.calls).toEqual([["-i"], ["-di"]]);
    expect(children[0].kill).toHaveBeenCalledTimes(1);
    expect(children[1].kill).not.toHaveBeenCalled();
  });

  it("uses the latest state when setting reads finish out of order", async () => {
    const child = fakeChild();
    const run = vi.fn(() => child);
    let release!: () => void;
    const slow = new Promise<string | null>((r) => (release = () => r("-i")));
    const reads = [slow, Promise.resolve("-i")];
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
    const set = createKeepAwake(async () => "-i", run, "darwin");
    await set(true);
    child.emit("error", new Error("ENOENT"));
    await set(true);
    expect(run).toHaveBeenCalledTimes(2);
  });
});
