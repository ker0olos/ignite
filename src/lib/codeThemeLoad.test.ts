import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeFs, type FakeTree } from "@/test/fakeFs";
import { CUSTOM_THEMES_DIR } from "./codeThemeDiscovery";

type Module = typeof import("./codeThemeLoad");

// codeThemeLoad caches resolved themes per module instance, so each test imports a fresh copy.
let m: Module;
beforeEach(async () => {
  vi.resetModules();
  m = await import("./codeThemeLoad");
});

const HOME = "/me";
const USER_EXT = `${HOME}/.vscode/extensions`;

/** Fake filesystem plus the home-directory lookup codeThemeLoad needs. */
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

describe("resolveTheme", () => {
  it("still resolves bundled themes that aren't offered, if one is saved", async () => {
    const { calls } = fake({});
    expect(await m.resolveTheme("nord", "dark")).toBe("nord");
    expect(await m.themeKind("nord")).toBe("dark");
    expect(calls).toEqual([]);
  });

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

describe("importTheme", () => {
  const dir = `${USER_EXT}/me.ohmy-0.2.1`;
  const editorTheme = extension(
    dir,
    {
      name: "ohmy",
      publisher: "me",
      contributes: {
        themes: [
          { label: "Oh My!!", uiTheme: "vs-dark", path: "./themes/main.json" },
        ],
      },
    },
    {
      "themes/base.json": JSON.stringify({ colors: { a: "#111111" } }),
      "themes/main.json": JSON.stringify({
        include: "./base.json",
        colors: { b: "#222222" },
        tokenColors: [{ scope: "keyword" }],
      }),
    },
  );

  it("copies an editor theme into the custom folder and returns the copy's id", async () => {
    const { mkdirs, writes } = fake(editorTheme);
    const id = await m.importTheme("vscode:me.ohmy/Oh My!!");

    expect(id).toBe("custom:me-ohmy-oh-my.json");
    expect(mkdirs).toEqual([{ path: CUSTOM_THEMES_DIR, recursive: true }]);
    expect(JSON.parse(writes[0])).toEqual({
      name: "Oh My!!",
      type: "dark",
      importedFrom: "vscode:me.ohmy/Oh My!!",
      colors: { a: "#111111", b: "#222222" },
      tokenColors: [{ scope: "keyword" }],
    });
  });

  it("drops the include, so the copy doesn't depend on the editor", async () => {
    const { writes } = fake(editorTheme);
    await m.importTheme("vscode:me.ohmy/Oh My!!");
    expect(JSON.parse(writes[0])).not.toHaveProperty("include");
  });

  it.each(["system", "dracula", "custom:mine.json"])(
    "leaves %s as it is",
    async (id) => {
      const { writes } = fake({});
      expect(await m.importTheme(id)).toBe(id);
      expect(writes).toEqual([]);
    },
  );

  it("leaves an editor theme that can't be found as it is", async () => {
    const { writes } = fake({});
    expect(await m.importTheme("vscode:gone/T")).toBe("vscode:gone/T");
    expect(writes).toEqual([]);
  });

  it("leaves an editor theme whose file can't be read as it is", async () => {
    const { writes } = fake({
      [`${dir}/package.json`]: editorTheme[`${dir}/package.json`],
    });
    expect(await m.importTheme("vscode:me.ohmy/Oh My!!")).toBe(
      "vscode:me.ohmy/Oh My!!",
    );
    expect(writes).toEqual([]);
  });

  it("lists a copied theme once, as the copy", async () => {
    fake({
      ...editorTheme,
      [`${HOME}/${CUSTOM_THEMES_DIR}/me-ohmy-oh-my.json`]: JSON.stringify({
        name: "Oh My!!",
        importedFrom: "vscode:me.ohmy/Oh My!!",
      }),
    });
    await m.importTheme("vscode:me.ohmy/Oh My!!");
    const discovery = await import("./codeThemeDiscovery");
    const ids = (await discovery.listThemes()).map((t) => t.id);
    expect(ids).toContain("custom:me-ohmy-oh-my.json");
    expect(ids).not.toContain("vscode:me.ohmy/Oh My!!");
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
