// @vitest-environment node
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, expect, it } from "vitest";
import ready, { waitsForReady } from "./readyExtension.ts";
import { setReady, whenReady } from "./worktreeReady.ts";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "ready-"));
  await writeFile(join(dir, "app.ts"), "app\n");
});
afterEach(() => rm(dir, { recursive: true, force: true }));

type Handler = (event: object, ctx: object) => Promise<unknown>;
const toolCall = () => {
  let handler: Handler = async () => {};
  ready({
    on: (_: string, h: Handler) => (handler = h),
  } as unknown as ExtensionAPI);
  return handler;
};

it("waits for writes, commands and git, and reads of files not there yet", () => {
  for (const tool of ["write", "edit", "bash", "git"])
    expect(waitsForReady(tool, {}, dir)).toBe(true);
  expect(waitsForReady("read", { path: "app.ts" }, dir)).toBe(false);
  expect(waitsForReady("read", { path: ".env" }, dir)).toBe(true);
  expect(
    waitsForReady(
      "read",
      { path: "app.ts", also: [{ path: "node_modules/x/index.d.ts" }] },
      dir,
    ),
  ).toBe(true);
  expect(waitsForReady("grep", { pattern: "x" }, dir)).toBe(false);
});

it("knows a workspace from anywhere inside it, and lets go once it's ready", async () => {
  let done = () => {};
  setReady(dir, new Promise<void>((resolve) => (done = resolve)));
  let ready = false;
  const sub = whenReady(join(dir, "sub")).then(() => (ready = true));
  await whenReady(join(tmpdir(), "elsewhere"));
  expect(ready).toBe(false);
  done();
  await sub;
  expect(ready).toBe(true);
});

it("holds a call until the workspace is ready, or the run stops", async () => {
  let done = () => {};
  setReady(dir, new Promise<void>((resolve) => (done = resolve)));
  const handler = toolCall();
  const stop = new AbortController();
  const settled: string[] = [];
  const call = (toolName: string, signal?: AbortSignal) =>
    handler({ toolName, input: {} }, { cwd: dir, signal }).then(() =>
      settled.push(toolName),
    );
  const held = call("bash");
  const stopped = call("write", stop.signal);
  await call("grep");
  expect(settled).toEqual(["grep"]);
  stop.abort();
  await stopped;
  expect(settled).toEqual(["grep", "write"]);
  done();
  await held;
  expect(settled).toEqual(["grep", "write", "bash"]);
});
