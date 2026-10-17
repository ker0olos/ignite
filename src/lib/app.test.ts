import { parse } from "smol-toml";
import { describe, expect, it } from "vitest";
import indexHtml from "../../index.html?raw";
import pkg from "../../package.json";
import capabilities from "../../src-tauri/capabilities/default.json";
import cargoToml from "../../src-tauri/Cargo.toml?raw";
import conf from "../../src-tauri/tauri.conf.json";
import { APP_NAME, APP_TITLE } from "./app";

// The app name lives in files that can't import APP_NAME. When renaming,
// these tests point at every one that still needs changing.

describe("app name", () => {
  it("matches package.json", () => {
    expect(pkg.name).toBe(APP_NAME);
  });

  it("matches the Cargo package", () => {
    const cargo = parse(cargoToml) as {
      package: { name: string };
    };
    expect(cargo.package.name).toBe(APP_NAME);
  });

  it("matches the Tauri product name, identifier and window title", () => {
    expect(conf.productName).toBe(APP_TITLE);
    expect(conf.identifier).toBe(`com.${APP_NAME}.app`);
    expect(conf.app.windows[0].title).toBe(APP_TITLE);
  });

  it("matches the page title", () => {
    expect(indexHtml).toContain(`<title>${APP_TITLE}</title>`);
  });

  it("is the same name in both spellings", () => {
    expect(APP_TITLE.toLowerCase()).toBe(APP_NAME);
  });

  it("matches the settings folder the frontend may write to", () => {
    const paths = capabilities.permissions.flatMap((p) =>
      typeof p === "string" || !p.identifier.match(/write|mkdir/)
        ? []
        : p.allow.flatMap((a) => ("path" in a ? [a.path] : [])),
    );
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect(path.startsWith(`$HOME/.${APP_NAME}`)).toBe(true);
    }
  });
});
