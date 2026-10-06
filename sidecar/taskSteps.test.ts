// @vitest-environment node
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEventBus } from "@earendil-works/pi-coding-agent";
import { afterEach, expect, it } from "vitest";
import { answerPlanned, isPlanned, writableUntilPlanned } from "./taskSteps.ts";

let dir = "";
afterEach(() => rmSync(dir, { recursive: true, force: true }));

it("is planned when nothing gates the session", async () => {
  expect(await isPlanned({ events: createEventBus() })).toBe(true);
});

it("leaves only what git ignores writable until the work is planned", async () => {
  dir = realpathSync(mkdtempSync(join(tmpdir(), "task-steps-")));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  writeFileSync(join(dir, ".gitignore"), "node_modules/\n*.tsbuildinfo\n");
  writeFileSync(join(dir, "a.ts"), "");
  writeFileSync(join(dir, "app.tsbuildinfo"), "");
  mkdirSync(join(dir, "node_modules", "x"), { recursive: true });
  writeFileSync(join(dir, "node_modules", "x", "i.js"), "");
  const events = createEventBus();
  let planned = false;
  answerPlanned({ events }, async () => planned);
  expect((await writableUntilPlanned({ events }, dir))?.sort()).toEqual([
    join(dir, "app.tsbuildinfo"),
    join(dir, "node_modules"),
  ]);
  planned = true;
  expect(await writableUntilPlanned({ events }, dir)).toBeUndefined();
});

it("leaves nothing writable in a folder outside git", async () => {
  dir = mkdtempSync(join(tmpdir(), "task-steps-"));
  const events = createEventBus();
  answerPlanned({ events }, async () => false);
  expect(await writableUntilPlanned({ events }, dir)).toEqual([]);
});
