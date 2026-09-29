// @vitest-environment node
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { CHROME_TOOLS } from "../shared/chrome.ts";
import { chromeToolsOn } from "./chromeSettings.ts";

const ALL = CHROME_TOOLS.map((t) => t.name);

async function settings(toml: string) {
  const file = join(await mkdtemp(join(tmpdir(), "chrome-")), "settings.toml");
  await writeFile(file, toml);
  return file;
}

it("leaves every tool on without settings", async () => {
  expect(await chromeToolsOn("/no/settings.toml")).toEqual(ALL);
  expect(await chromeToolsOn(await settings("[editor]\n"))).toEqual(ALL);
});

it("turns every tool off when Chrome is off", async () => {
  expect(
    await chromeToolsOn(await settings("[chrome]\nenabled = false\n")),
  ).toEqual([]);
});

it("drops the tools switched off", async () => {
  const file = await settings(
    '[chrome]\nenabled = true\ndisabled_tools = ["chrome_cdp", "chrome_eval"]\n',
  );
  expect(await chromeToolsOn(file)).toEqual([
    "chrome_tabs",
    "chrome_screenshot",
    "chrome_navigate",
  ]);
});
