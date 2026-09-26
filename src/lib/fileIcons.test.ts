import { Braces, CodeXml, File, Hash, Lock } from "lucide-react";
import { describe, expect, it } from "vitest";
import { fileIcon } from "./fileIcons";

describe("fileIcon", () => {
  it.each([
    ["styles.css", Hash],
    ["App.tsx", CodeXml],
    ["package.json", Braces],
    ["Cargo.lock", Lock],
  ])("maps %s by extension", (name, icon) => {
    expect(fileIcon(name)).toBe(icon);
  });

  it("ignores extension case", () => {
    expect(fileIcon("DATA.JSON")).toBe(Braces);
  });

  it("uses the last extension of a multi-dot name", () => {
    expect(fileIcon("tsconfig.node.json")).toBe(Braces);
  });

  it("falls back to a plain file for unknown extensions", () => {
    expect(fileIcon("notes.xyz")).toBe(File);
  });

  it("falls back to a plain file when there is no extension", () => {
    expect(fileIcon("Makefile")).toBe(File);
  });

  it("does not treat a name that equals an extension as one", () => {
    // "json" has no dot, so it is not a .json file.
    expect(fileIcon("json")).toBe(File);
  });
});
