// @vitest-environment node
import { createBashToolDefinition } from "@earendil-works/pi-coding-agent";
import { expect, it } from "vitest";
import { skippable, skipWait } from "./skipWait.ts";

const textOf = (done: unknown) =>
  (done as { content: { text: string }[] }).content[0].text;

/** Runs `command` in pi's bash as the bash tool does, its sleeps skippable. */
const run = (id: string, command: string) =>
  skippable(id, (spawnHook) =>
    createBashToolDefinition(process.cwd(), { spawnHook }).execute(
      id,
      { command },
      undefined,
      undefined,
      undefined as never,
    ),
  );

/** Skips `id`'s wait once its sleep has started. */
async function skipWhenSleeping(id: string) {
  for (let i = 0; i < 100 && !skipWait(id); i++) {
    await new Promise((r) => setTimeout(r, 50));
  }
}

it.skipIf(process.platform === "win32")(
  "ends the sleep as if it finished, and the command carries on",
  async () => {
    const started = Date.now();
    const done = run("call-1", "echo before; sleep 30 && echo after");
    await skipWhenSleeping("call-1");
    expect(textOf(await done)).toBe("before\nafter\n");
    expect(Date.now() - started).toBeLessThan(10_000);
  },
);

it.skipIf(process.platform === "win32")(
  "skips only the sleep running now; a later one waits again",
  async () => {
    const done = run("call-2", "sleep 30; sleep 0.2; echo done");
    await skipWhenSleeping("call-2");
    expect(textOf(await done)).toBe("done\n");
  },
);

it("has nothing to skip in a command that isn't sleeping, or once it ended", async () => {
  const done = run("call-3", "echo hi");
  expect(skipWait("call-3")).toBe(false);
  expect(textOf(await done)).toBe("hi\n");
  expect(skipWait("call-3")).toBe(false);
});
