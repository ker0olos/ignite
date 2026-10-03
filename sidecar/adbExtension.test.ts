import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { adbProgram } from "./adbExtension.ts";

describe("adbProgram", () => {
  const sdk = join(homedir(), "Library/Android/sdk/platform-tools/adb");

  it("prefers adb on PATH", () => {
    const has = (p: string) => p === "/opt/bin/adb" || p === sdk;
    expect(adbProgram({ PATH: "/usr/bin:/opt/bin" }, has)).toBe("/opt/bin/adb");
  });

  it("falls back to ANDROID_HOME, then the default SDK folder", () => {
    const env = { PATH: "/usr/bin", ANDROID_HOME: "/sdk" };
    expect(adbProgram(env, (p) => p === "/sdk/platform-tools/adb")).toBe(
      "/sdk/platform-tools/adb",
    );
    expect(adbProgram(env, (p) => p === sdk)).toBe(sdk);
  });

  it("reads a Windows PATH and looks for adb.exe", () => {
    const has = (p: string) => p === join("C:\\sdk", "adb.exe");
    expect(adbProgram({ PATH: "C:\\x;C:\\sdk" }, has, true)).toBe(
      join("C:\\sdk", "adb.exe"),
    );
    expect(adbProgram({}, () => false, true)).toBe("adb.exe");
  });

  it("leaves it to PATH when nothing is found", () => {
    expect(adbProgram({}, () => false)).toBe("adb");
  });
});
