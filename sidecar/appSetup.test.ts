// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "smol-toml";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildsBinary, enableWindowsSandbox } from "./appSetup.ts";

let home: string;
const settings = () => join(home, ".ignite", "settings.toml");

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "app-setup-"));
});
afterEach(() => rm(home, { recursive: true, force: true }));

describe("enableWindowsSandbox", () => {
  it("turns it on, keeping the other settings", async () => {
    await mkdir(join(home, ".ignite"));
    await writeFile(
      settings(),
      'theme = "nord"\n[approval]\nmode = "manual"\n',
    );
    await enableWindowsSandbox(home);
    expect(parse(await readFile(settings(), "utf8"))).toEqual({
      theme: "nord",
      approval: { mode: "manual", windows_sandbox: true },
    });
  });

  it("writes the setting with no settings yet, or ones that don't parse", async () => {
    await enableWindowsSandbox(home);
    expect(parse(await readFile(settings(), "utf8"))).toEqual({
      approval: { windows_sandbox: true },
    });
    await writeFile(settings(), "theme = ");
    await enableWindowsSandbox(home);
    expect(parse(await readFile(settings(), "utf8"))).toEqual({
      approval: { windows_sandbox: true },
    });
  });
});

describe("buildsBinary", () => {
  it("only where CI builds none", () => {
    expect(buildsBinary("darwin-arm64")).toBe(false);
    expect(buildsBinary("win32-x64")).toBe(false);
    expect(buildsBinary("linux-arm64")).toBe(true);
  });
});
