// @vitest-environment node
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const spawned: { cmd: string; args: string[] }[] = [];
vi.mock("node:child_process", () => ({
  spawn: (cmd: string, args: string[]) => {
    spawned.push({ cmd, args });
    return { unref: () => {} };
  },
  spawnSync: (cmd: string, args: string[]) => {
    spawned.push({ cmd, args });
    return { status: 0, stderr: "" };
  },
}));
const { addLauncher, desktopEntry, unixLaunch, userData, windowsLaunch } =
  await import("./appLauncher.ts");

let dir: string;
const place = () => ({
  clone: join(dir, "clone"),
  home: join(dir, "home"),
  path: "/usr/bin:/it's/bin",
  data: join(dir, "data"),
});

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "app-launcher-"));
  await mkdir(join(dir, "clone", "src-tauri", "icons"), { recursive: true });
  await writeFile(
    join(dir, "clone", "src-tauri", "icons", "icon.icns"),
    "icon",
  );
  spawned.length = 0;
});
afterEach(() => rm(dir, { recursive: true, force: true }));

describe("launch scripts", () => {
  it("keep setup's PATH, quoted for the shell they run in", () => {
    expect(unixLaunch(place())).toContain(
      `export PATH='/usr/bin:/it'\\''s/bin'`,
    );
    expect(unixLaunch(place())).toContain(
      `exec node '${join(dir, "clone", "launcher", "launch.mjs")}'`,
    );
    expect(windowsLaunch(place())).toContain(
      `$env:PATH = '/usr/bin:/it''s/bin'`,
    );
  });

  it("names the launch script in the Linux menu entry", () => {
    const entry = desktopEntry("/h/.ignite/bin/ignite-launch", "/c");
    expect(entry).toContain(`Exec="/h/.ignite/bin/ignite-launch"`);
    expect(entry).toContain("Icon=/c/src-tauri/icons/icon.png");
  });
});

describe("userData", () => {
  it("is APPDATA on Windows and XDG_DATA_HOME elsewhere, with their defaults", () => {
    expect(userData("win32", "/h", { APPDATA: "/a" })).toBe("/a");
    expect(userData("win32", "/h", {})).toBe(join("/h", "AppData", "Roaming"));
    expect(userData("linux", "/h", { XDG_DATA_HOME: "/x" })).toBe("/x");
    expect(userData("linux", "/h", {})).toBe(join("/h", ".local", "share"));
  });
});

describe("addLauncher", () => {
  it("makes ~/Applications/Ignite.app on macOS and opens it", async () => {
    expect(await addLauncher(place(), "darwin")).toBe(
      "Ignite is in ~/Applications.",
    );
    const contents = join(
      dir,
      "home",
      "Applications",
      "Ignite.app",
      "Contents",
    );
    const launch = join(contents, "MacOS", "launch");
    expect((await stat(launch)).mode & 0o111).toBeTruthy();
    expect(await readFile(join(contents, "Info.plist"), "utf8")).toContain(
      "<key>LSUIElement</key><true/>",
    );
    expect(
      await readFile(join(contents, "Resources", "icon.icns"), "utf8"),
    ).toBe("icon");
    expect(spawned).toEqual([
      { cmd: "open", args: [join(dir, "home", "Applications", "Ignite.app")] },
    ]);
  });

  it("adds an app menu entry on Linux and starts it", async () => {
    expect(await addLauncher(place(), "linux")).toBe(
      "Ignite is in your app menu.",
    );
    const launch = join(dir, "home", ".ignite", "bin", "ignite-launch");
    const entry = join(dir, "data", "applications", "ignite.desktop");
    expect(await readFile(entry, "utf8")).toContain(`Exec="${launch}"`);
    expect(spawned.map((s) => s.cmd)).toEqual([
      "update-desktop-database",
      launch,
    ]);
  });

  it("adds a Start Menu shortcut on Windows and starts it hidden", async () => {
    expect(await addLauncher(place(), "win32")).toBe(
      "Ignite is in the Start Menu.",
    );
    const launch = join(dir, "home", ".ignite", "bin", "ignite-launch.ps1");
    expect(await readFile(launch, "utf8")).toContain("& node ");
    const [shortcut, started] = spawned;
    expect(shortcut.cmd).toBe("powershell.exe");
    expect(shortcut.args.at(-1)).toContain(
      join(
        dir,
        "data",
        "Microsoft",
        "Windows",
        "Start Menu",
        "Programs",
        "Ignite.lnk",
      ),
    );
    expect(started.args).toEqual(
      expect.arrayContaining(["-WindowStyle", "Hidden", "-File", launch]),
    );
  });
});
