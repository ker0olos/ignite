import { describe, expect, it } from "vitest";
import {
  glyph,
  iconIdFor,
  normalizeTheme,
  type IconThemeFile,
} from "./iconResolve";

const theme = normalizeTheme({
  iconDefinitions: {},
  file: "file",
  folder: "folder",
  folderExpanded: "folder-open",
  fileNames: { "Package.json": "npm" },
  fileExtensions: { "d.ts": "typings", ts: "ts" },
  folderNames: { src: "src" },
  folderNamesExpanded: { src: "src-open" },
  languageIds: { javascript: "js", dockerfile: "docker" },
  light: { fileExtensions: { ts: "ts-light" }, file: "file-light" },
});

describe("iconIdFor", () => {
  it.each([
    ["package.json", "npm"],
    ["index.d.ts", "typings"],
    ["app.TS", "ts"],
    ["main.js", "js"],
    ["Dockerfile", "docker"],
    ["notes.xyz", "file"],
    ["Makefile", "file"],
  ])("finds %s's icon", (name, id) => {
    expect(iconIdFor(theme, name, "file", false)).toBe(id);
  });

  it("tries the light overrides first in light mode", () => {
    expect(iconIdFor(theme, "app.ts", "file", true)).toBe("ts-light");
    expect(iconIdFor(theme, "index.d.ts", "file", true)).toBe("typings");
    expect(iconIdFor(theme, "notes.xyz", "file", true)).toBe("file-light");
  });

  it("names folders, open or closed", () => {
    expect(iconIdFor(theme, "SRC", "folder", false)).toBe("src");
    expect(iconIdFor(theme, "src", "openFolder", false)).toBe("src-open");
    expect(iconIdFor(theme, "lib", "folder", false)).toBe("folder");
    expect(iconIdFor(theme, "lib", "openFolder", false)).toBe("folder-open");
  });

  it("falls back to a folder's closed icons when it has no open ones", () => {
    const plain: IconThemeFile = {
      iconDefinitions: {},
      folder: "folder",
      folderNames: { src: "src" },
    };
    expect(iconIdFor(plain, "src", "openFolder", false)).toBe("src");
    expect(iconIdFor(plain, "lib", "openFolder", false)).toBe("folder");
  });

  it("has nothing for a theme without defaults", () => {
    const empty: IconThemeFile = { iconDefinitions: {} };
    expect(iconIdFor(empty, "a.ts", "file", true)).toBeUndefined();
    expect(iconIdFor(empty, "src", "folder", false)).toBeUndefined();
  });
});

describe("glyph", () => {
  it("turns an escaped code point into its character", () => {
    expect(glyph("\\E001")).toBe("\uE001");
    expect(glyph("A")).toBe("A");
  });
});
