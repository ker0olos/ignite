import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeFs, type FakeTree } from "@/test/fakeFs";
import { BUILT_IN_THEMES } from "./codeThemes";
import { CUSTOM_THEMES_DIR } from "./codeThemeDiscovery";

type Module = typeof import("./codeThemeDiscovery");

// codeThemeDiscovery caches the scan per module instance, so each test imports a fresh copy.
let m: Module;
beforeEach(async () => {
  vi.resetModules();
  m = await import("./codeThemeDiscovery");
});

const HOME = "/me";
const USER_EXT = `${HOME}/.vscode/extensions`;
const CODIUM_EXT = `${HOME}/.vscode-oss/extensions`;
const APP_EXT = "/Applications/VSCodium.app/Contents/Resources/app/extensions";

/** Fake filesystem plus the home-directory lookup codeThemeDiscovery needs. */
function fake(tree: FakeTree) {
  return fakeFs(tree, (cmd) => {
    if (cmd === "plugin:path|resolve_directory") return HOME;
    throw new Error(`unmocked command: ${cmd}`);
  });
}

/** An extension folder with a package.json contributing `themes`. */
function extension(
  dir: string,
  manifest: Record<string, unknown>,
  files: FakeTree = {},
): FakeTree {
  const tree: FakeTree = { [`${dir}/package.json`]: JSON.stringify(manifest) };
  for (const [name, content] of Object.entries(files)) {
    tree[`${dir}/${name}`] = content;
  }
  return tree;
}

const vscodeThemes = async () =>
  (await m.listThemes()).filter((t) => t.source !== "Built-in");

describe("listThemes", () => {
  it("includes every built-in theme with its kind", async () => {
    fake({});
    const themes = await m.listThemes();
    expect(themes.find((t) => t.id === "github-dark")).toMatchObject({
      label: "GitHub Dark",
      kind: "dark",
      source: "Built-in",
    });
    expect(themes.filter((t) => t.source === "Built-in").length).toBe(
      BUILT_IN_THEMES.length,
    );
  });

  it("finds themes contributed by installed extensions", async () => {
    fake(
      extension(
        `${USER_EXT}/me.ohmy-0.2.1`,
        {
          name: "ohmy",
          publisher: "me",
          contributes: {
            themes: [
              { label: "Oh My", uiTheme: "vs-dark", path: "./theme.json" },
            ],
          },
        },
        { "theme.json": "{}" },
      ),
    );
    expect(await vscodeThemes()).toEqual([
      {
        id: "vscode:me.ohmy/Oh My",
        label: "Oh My",
        kind: "dark",
        source: "VS Code",
        path: `${USER_EXT}/me.ohmy-0.2.1/theme.json`,
      },
    ]);
  });

  it("leaves the version out of ids so a saved choice survives updates", async () => {
    const manifest = {
      name: "ohmy",
      publisher: "me",
      contributes: { themes: [{ label: "A", uiTheme: "vs", path: "a.json" }] },
    };
    fake(extension(`${USER_EXT}/me.ohmy-0.2.1`, manifest));
    const before = (await vscodeThemes())[0].id;
    fake(extension(`${USER_EXT}/me.ohmy-0.3.0`, manifest));
    const after = (await m.listThemes(true)).find(
      (t) => t.source === "VS Code",
    );
    expect(after?.id).toBe(before);
  });

  it.each([
    ["vs", "light"],
    ["hc-light", "light"],
    ["vs-dark", "dark"],
    ["hc-black", "dark"],
  ])("maps uiTheme %s to %s", async (uiTheme, kind) => {
    fake(
      extension(`${USER_EXT}/x`, {
        name: "x",
        publisher: "p",
        contributes: { themes: [{ label: "T", uiTheme, path: "t.json" }] },
      }),
    );
    expect((await vscodeThemes())[0].kind).toBe(kind);
  });

  it("prefers a theme's own id over its label in the id", async () => {
    fake(
      extension(`${USER_EXT}/x`, {
        name: "x",
        publisher: "p",
        contributes: {
          themes: [{ id: "Stable", label: "Pretty", uiTheme: "vs", path: "t" }],
        },
      }),
    );
    expect((await vscodeThemes())[0]).toMatchObject({
      id: "vscode:p.x/Stable",
      label: "Pretty",
    });
  });

  it("translates %key% labels from package.nls.json", async () => {
    fake(
      extension(
        `${APP_EXT}/theme-defaults`,
        {
          name: "theme-defaults",
          publisher: "vscode",
          contributes: {
            themes: [
              {
                id: "Dark+",
                label: "%darkPlus%",
                uiTheme: "vs-dark",
                path: "a",
              },
              { id: "Obj", label: "%obj%", uiTheme: "vs", path: "b" },
              { id: "Gone", label: "%gone%", uiTheme: "vs", path: "c" },
            ],
          },
        },
        {
          "package.nls.json": JSON.stringify({
            darkPlus: "Dark+",
            obj: { message: "From Object", comment: ["translators"] },
          }),
        },
      ),
    );
    const labels = (await vscodeThemes()).map((t) => t.label);
    // A key with no translation is shown as written rather than dropped.
    expect(labels).toEqual(["Dark+", "From Object", "%gone%"]);
  });

  it("keeps labels as written when there is no package.nls.json", async () => {
    fake(
      extension(`${USER_EXT}/x`, {
        name: "x",
        publisher: "p",
        contributes: { themes: [{ label: "%raw%", uiTheme: "vs", path: "t" }] },
      }),
    );
    expect((await vscodeThemes())[0].label).toBe("%raw%");
  });

  it("names extensions without a publisher as built-in vscode ones", async () => {
    fake(
      extension(`${APP_EXT}/theme-red`, {
        name: "theme-red",
        contributes: {
          themes: [{ label: "Red", uiTheme: "vs-dark", path: "t" }],
        },
      }),
    );
    expect((await vscodeThemes())[0].id).toBe("vscode:vscode.theme-red/Red");
  });

  it("falls back to the folder name for extensions without a name", async () => {
    fake(
      extension(`${USER_EXT}/loose-theme`, {
        publisher: "p",
        contributes: { themes: [{ label: "T", uiTheme: "vs", path: "t" }] },
      }),
    );
    expect((await vscodeThemes())[0].id).toBe("vscode:p.loose-theme/T");
  });

  it("lists an extension installed in two editors once", async () => {
    const manifest = {
      name: "x",
      publisher: "p",
      contributes: { themes: [{ label: "T", uiTheme: "vs", path: "t" }] },
    };
    fake({
      ...extension(`${USER_EXT}/p.x-1`, manifest),
      ...extension(`${CODIUM_EXT}/p.x-1`, manifest),
    });
    expect(await vscodeThemes()).toHaveLength(1);
  });

  it("skips extensions without themes, broken manifests and stray files", async () => {
    fake({
      ...extension(`${USER_EXT}/no-themes`, { name: "a", contributes: {} }),
      [`${USER_EXT}/broken/package.json`]: "{ not json",
      [`${USER_EXT}/array/package.json`]: "[]",
      [`${USER_EXT}/.obsolete`]: "{}",
    });
    expect(await vscodeThemes()).toEqual([]);
  });

  it("reads custom theme files, using their name and type", async () => {
    const dir = `${HOME}/${CUSTOM_THEMES_DIR}`;
    fake({
      [`${dir}/paper.json`]: '{ "name": "Paper", "type": "light" }',
      [`${dir}/night.json`]: "{ // comments are fine\n }",
      [`${dir}/notes.txt`]: "not a theme",
      [`${dir}/bad.json`]: "nope",
    });
    const custom = (await m.listThemes()).filter((t) => t.source === "Custom");
    expect(custom).toEqual([
      {
        id: "custom:paper.json",
        label: "Paper",
        kind: "light",
        source: "Custom",
        path: `${dir}/paper.json`,
      },
      {
        id: "custom:night.json",
        label: "night",
        kind: "dark",
        source: "Custom",
        path: `${dir}/night.json`,
      },
    ]);
  });

  it("caches the scan until asked to refresh", async () => {
    const { calls } = fake({});
    await m.listThemes();
    const scans = calls.length;
    await m.listThemes();
    expect(calls.length).toBe(scans);
    await m.listThemes(true);
    expect(calls.length).toBeGreaterThan(scans);
  });
});

describe("importedFileName", () => {
  it("makes a readable, filesystem-safe name from the theme id", () => {
    expect(m.importedFileName("vscode:vscode.theme-defaults/Dark+")).toBe(
      "vscode-theme-defaults-dark.json",
    );
  });

  it("falls back to a generic name when nothing usable is left", () => {
    expect(m.importedFileName("vscode:!!!")).toBe("theme.json");
  });
});
