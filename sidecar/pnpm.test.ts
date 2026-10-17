import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { pnpmInstall } from "./pnpm.ts";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "pnpm-"));
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const pin = (packageManager?: string) =>
  writeFile(join(dir, "package.json"), JSON.stringify({ packageManager }));

it.skipIf(process.platform === "win32")(
  "installs with the pnpm the package pins, once it's there",
  async () => {
    await pin("pnpm@12.14.0+sha512.abc");
    const bin = join(dir, "home/pnpm/12.14.0/node_modules/pnpm/pnpm");
    await mkdir(join(bin, ".."), { recursive: true });
    // Written where it runs: the package's folder.
    await writeFile(bin, '#!/bin/sh\necho "$@" > ran.txt\n');
    await chmod(bin, 0o755);
    await pnpmInstall(dir, join(dir, "home"));
    expect((await readFile(join(dir, "ran.txt"), "utf8")).trim()).toBe(
      "install --frozen-lockfile --prefer-offline",
    );
  },
);

it("refuses a package that pins no pnpm", async () => {
  for (const packageManager of [undefined, "npm@11.0.0", "pnpm@latest"]) {
    await pin(packageManager);
    await expect(pnpmInstall(dir, join(dir, "home"))).rejects.toThrow(
      "pins no pnpm version",
    );
  }
});
