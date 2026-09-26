import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeFs, type FakeTree } from "@/test/fakeFs";
import { CUSTOM_THEMES_DIR, type CodeTheme } from "./codeThemes";

type Module = typeof import("./codeThemes");

// codeThemes caches discovered and loaded themes per module instance, so
// each test imports a fresh copy.
let m: Module;
beforeEach(async () => {
  vi.resetModules();
  m = await import("./codeThemes");
});

const HOME = "/me";
const USER_EXT = `${HOME}/.vscode/extensions`;
const CODIUM_EXT = `${HOME}/.vscode-oss/extensions`;
const APP_EXT = "/Applications/VSCodium.app/Contents/Resources/app/extensions";

/** Fake filesystem plus the home-directory lookup codeThemes needs. */
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

describe("codeThemesFor", () => {
  it("pairs GitHub Light and Dark for system", () => {
    expect(m.codeThemesFor("system")).toEqual({
      light: "github-light",
      dark: "github-dark",
    });
  });

  it("uses a chosen theme for both appearances", () => {
    expect(m.codeThemesFor("dracula")).toEqual({
      light: "dracula",
      dark: "dracula",
    });
  });
});

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
      m.BUILT_IN_THEMES.length,
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

describe("resolveTheme", () => {
  it("returns built-in themes by name without touching the disk", async () => {
    const { calls } = fake({});
    expect(await m.resolveTheme("dracula", "dark")).toBe("dracula");
    expect(calls).toEqual([]);
  });

  const dir = `${USER_EXT}/p.x`;
  const withTheme = (files: FakeTree, path = "themes/main.json") =>
    extension(
      dir,
      {
        name: "x",
        publisher: "p",
        contributes: { themes: [{ label: "Main", uiTheme: "vs-dark", path }] },
      },
      files,
    );

  it("loads a VS Code theme file, allowing comments and trailing commas", async () => {
    fake(
      withTheme({
        "themes/main.json": `{
          // A comment
          "colors": { "editor.foreground": "#ffffff", },
          "tokenColors": [{ "scope": "keyword", "settings": { "foreground": "#ff0000" } }],
        }`,
      }),
    );
    const theme = await m.resolveTheme("vscode:p.x/Main", "dark");
    expect(theme).toMatchObject({
      name: "vscode:p.x/Main",
      type: "dark",
      colors: { "editor.foreground": "#ffffff" },
      tokenColors: [{ scope: "keyword" }],
    });
  });

  it("merges the themes it includes, its own values winning", async () => {
    fake(
      withTheme({
        "themes/base.json": JSON.stringify({
          colors: { a: "#111111", b: "#222222" },
          tokenColors: [{ scope: "base" }],
        }),
        "themes/main.json": JSON.stringify({
          include: "./base.json",
          colors: { b: "#999999" },
          tokenColors: [{ scope: "own" }],
        }),
      }),
    );
    const theme = (await m.resolveTheme("vscode:p.x/Main", "dark")) as {
      colors: Record<string, string>;
      tokenColors: { scope: string }[];
    };
    expect(theme.colors).toEqual({ a: "#111111", b: "#999999" });
    expect(theme.tokenColors.map((t) => t.scope)).toEqual(["base", "own"]);
  });

  it("stops following includes that loop", async () => {
    fake(
      withTheme({
        "themes/main.json": JSON.stringify({
          include: "./main.json",
          tokenColors: [{ scope: "x" }],
        }),
      }),
    );
    const theme = await m.resolveTheme("vscode:p.x/Main", "dark");
    expect(theme).toMatchObject({ name: "vscode:p.x/Main" });
  });

  it("ignores tokenColors pointing at a .tmTheme file", async () => {
    fake(
      withTheme({
        "themes/main.json": JSON.stringify({
          colors: { a: "#111111" },
          tokenColors: "./legacy.tmTheme",
        }),
      }),
    );
    expect(await m.resolveTheme("vscode:p.x/Main", "dark")).toMatchObject({
      tokenColors: [],
    });
  });

  it("falls back to the default for the appearance when a theme is missing", async () => {
    fake({});
    expect(await m.resolveTheme("vscode:gone/Theme", "light")).toBe(
      "github-light",
    );
    expect(await m.resolveTheme("vscode:gone/Theme", "dark")).toBe(
      "github-dark",
    );
  });

  it("falls back to the default when the theme file can't be read", async () => {
    fake(withTheme({}));
    expect(await m.resolveTheme("vscode:p.x/Main", "dark")).toBe("github-dark");
  });

  it("reads each theme file once", async () => {
    const { calls } = fake(withTheme({ "themes/main.json": "{}" }));
    await m.resolveTheme("vscode:p.x/Main", "dark");
    const reads = calls.length;
    await m.resolveTheme("vscode:p.x/Main", "dark");
    expect(calls.length).toBe(reads);
  });
});

describe("themeKind", () => {
  it("is null for system, meaning follow macOS", async () => {
    expect(await m.themeKind("system")).toBeNull();
  });

  it("knows built-in themes without scanning", async () => {
    const { calls } = fake({});
    expect(await m.themeKind("github-light")).toBe("light");
    expect(calls).toEqual([]);
  });

  it("looks up discovered themes", async () => {
    fake(
      extension(`${USER_EXT}/x`, {
        name: "x",
        publisher: "p",
        contributes: { themes: [{ label: "T", uiTheme: "vs", path: "t" }] },
      }),
    );
    expect(await m.themeKind("vscode:p.x/T")).toBe("light");
  });

  it("is null for an unknown theme", async () => {
    fake({});
    expect(await m.themeKind("vscode:gone/T")).toBeNull();
  });

  it("is null when scanning fails", async () => {
    fakeFs({}, () => {
      throw new Error("no home");
    });
    expect(await m.themeKind("vscode:p.x/T")).toBeNull();
  });
});

describe("themeGroups", () => {
  const theme = (
    id: string,
    source: CodeTheme["source"],
    label = id,
  ): CodeTheme => ({ id, label, kind: "dark", source });

  const themes = [
    theme("z", "Built-in", "Zed"),
    theme("a", "Built-in", "Alpha"),
    theme("custom:mine.json", "Custom", "Mine"),
    theme("vscode:p.x/T", "VS Code", "Theirs"),
  ];

  it("groups by source in a fixed order, sorted by label", () => {
    expect(
      m
        .themeGroups(themes, "a")
        .map((g) => [g.source, g.themes.map((t) => t.label)]),
    ).toEqual([
      ["Built-in", ["Alpha", "Zed"]],
      ["VS Code", ["Theirs"]],
      ["Custom", ["Mine"]],
    ]);
  });

  it("leaves out empty groups", () => {
    const groups = m.themeGroups([theme("a", "Built-in")], "a");
    expect(groups.map((g) => g.source)).toEqual(["Built-in"]);
  });

  it("keeps a saved theme that no longer exists, first, as Missing", () => {
    const groups = m.themeGroups(themes, "vscode:gone/Old");
    expect(groups[0]).toMatchObject({
      source: "Missing",
      themes: [{ id: "vscode:gone/Old" }],
    });
  });

  it("does not treat system as missing", () => {
    const groups = m.themeGroups(themes, "system");
    expect(groups.map((g) => g.source)).not.toContain("Missing");
  });
});
