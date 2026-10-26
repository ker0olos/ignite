// @vitest-environment node
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { learningOn } from "./learningSettings.ts";

it("is on unless its section says enabled = false, and when the file is missing or broken", async () => {
  const file = join(mkdtempSync(join(tmpdir(), "learning-")), "settings.toml");
  expect(await learningOn("lessons", file)).toBe(true);
  writeFileSync(
    file,
    "[lessons]\nenabled = false\n[reflector]\nenabled = true\n",
  );
  expect(await learningOn("lessons", file)).toBe(false);
  expect(await learningOn("reflector", file)).toBe(true);
  expect(await learningOn("procedures", file)).toBe(true);
  writeFileSync(file, "not = [toml");
  expect(await learningOn("lessons", file)).toBe(true);
});
