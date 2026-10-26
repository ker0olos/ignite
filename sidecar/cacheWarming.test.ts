import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { warmCachesWhenIdle } from "./cacheWarming.ts";

let dir: string;
const settings = async () =>
  JSON.parse(await readFile(join(dir, "settings.json"), "utf8")) as Record<
    string,
    unknown
  >;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "warm-"));
});
afterEach(() => rm(dir, { recursive: true, force: true }));

it("keeps caches warm between runs, keeping pi's other settings", async () => {
  await writeFile(
    join(dir, "settings.json"),
    JSON.stringify({ defaultModel: "m" }),
  );
  await warmCachesWhenIdle(dir);
  expect(await settings()).toEqual({ defaultModel: "m", cacheWarming: "idle" });
});

it("leaves a choice already made", async () => {
  await writeFile(
    join(dir, "settings.json"),
    JSON.stringify({ cacheWarming: "off" }),
  );
  await warmCachesWhenIdle(dir);
  expect(await settings()).toEqual({ cacheWarming: "off" });
});

it("writes the setting when pi has no settings yet", async () => {
  await warmCachesWhenIdle(dir);
  expect((await settings()).cacheWarming).toBe("idle");
});
