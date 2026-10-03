import { describe, expect, it } from "vitest";
import { adbCommand, adbHostPaths, adbNeverExits } from "./adb.ts";

describe("adbCommand", () => {
  it("skips global options and their values", () => {
    expect(adbCommand(["-s", "emu", "-d", "shell", "ls"])).toEqual({
      name: "shell",
      rest: ["ls"],
    });
    expect(adbCommand(["-s", "emu"])).toBeNull();
  });
});

describe("adbHostPaths", () => {
  it("names the local side of each transfer", () => {
    expect(adbHostPaths(["push", "-z", "a", "b", "/sdcard/"])).toEqual([
      "a",
      "b",
    ]);
    expect(adbHostPaths(["pull", "/sdcard/x", "out"])).toEqual(["out"]);
    expect(adbHostPaths(["pull", "/sdcard/x"])).toEqual([]);
    expect(adbHostPaths(["install-multiple", "a.apk", "b.apk"])).toEqual([
      "a.apk",
      "b.apk",
    ]);
    expect(adbHostPaths(["shell", "cat", "/etc/hosts"])).toEqual([]);
    expect(adbHostPaths([])).toEqual([]);
  });
});

describe("adbNeverExits", () => {
  it("refuses a bare shell and a streaming logcat", () => {
    expect(adbNeverExits(["shell"])).toMatch(/waits for input/);
    expect(adbNeverExits(["logcat"])).toMatch(/keeps streaming/);
    expect(adbNeverExits(["shell", "logcat", "-v", "brief"])).toMatch(
      /keeps streaming/,
    );
  });

  it("lets calls that end run", () => {
    expect(adbNeverExits(["shell", "ls"])).toBeNull();
    expect(adbNeverExits(["logcat", "-d"])).toBeNull();
    expect(adbNeverExits(["shell", "logcat", "-t", "100"])).toBeNull();
    expect(adbNeverExits(["devices"])).toBeNull();
    expect(adbNeverExits([])).toBeNull();
  });
});
