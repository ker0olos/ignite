import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeFs, type FakeTree } from "@/test/fakeFs";

type Module = typeof import("./iconThemes");

// iconThemes caches the scan per module instance, so each test imports a fresh copy.
let m: Module;
beforeEach(async () => {
  vi.resetModules();
  m = await import("./iconThemes");
});

const HOME = "/me";
const USER_EXT = `${HOME}/.vscode/extensions`;
const CUSTOM = `${HOME}/.ignite/icon-themes`;

function fake(tree: FakeTree) {
  return fakeFs(tree, (cmd) => {
    if (cmd === "plugin:path|resolve_directory") return HOME;
    throw new Error(`unmocked command: ${cmd}`);
  });
}

const manifest = (name: string, themes: object[]) =>
  JSON.stringify({
    publisher: "pub",
    name,
    contributes: { iconThemes: themes },
  });

const SETI = {
  [`${USER_EXT}/pub.seti-1.0.0/package.json`]: manifest("seti", [
    { id: "seti", label: "Seti", path: "./icons/seti.json" },
  ]),
  [`${USER_EXT}/pub.seti-1.0.0/icons/seti.json`]: JSON.stringify({
    fonts: [{ id: "f", src: [{ path: "./seti.woff" }], size: "150%" }],
    iconDefinitions: {
      ts: { fontCharacter: "\\E001", fontColor: "#519aba" },
      md: { iconPath: "./../icons/./md.svg" },
    },
    fileExtensions: { TS: "ts", md: "md" },
  }),
  [`${USER_EXT}/pub.seti-1.0.0/icons/seti.woff`]: new Uint8Array([1]),
  [`${USER_EXT}/pub.seti-1.0.0/icons/md.svg`]: "<svg/>",
};

describe("listIconThemes", () => {
  it("finds editors' and custom icon themes, each once", async () => {
    fake({
      ...SETI,
      [`${USER_EXT}/pub.code-themes/package.json`]: manifest("code-themes", []),
      [`${USER_EXT}/broken/package.json`]: "{",
      [`${USER_EXT}/stray.txt`]: "",
      [`${CUSTOM}/mine/package.json`]: JSON.stringify({
        contributes: {
          iconThemes: [{ id: "jb", label: "%jb%", path: "jb.json" }],
        },
      }),
      [`${CUSTOM}/mine/package.nls.json`]: JSON.stringify({ jb: "JetBrains" }),
      [`${HOME}/.cursor/extensions/pub.seti-1.0.1/package.json`]: manifest(
        "seti",
        [{ id: "seti", label: "Seti", path: "./icons/seti.json" }],
      ),
    });
    expect(await m.listIconThemes()).toEqual([
      {
        id: "vscode.mine/jb",
        label: "JetBrains",
        source: "Custom",
        path: `${CUSTOM}/mine/jb.json`,
      },
      {
        id: "pub.seti/seti",
        label: "Seti",
        source: "VS Code",
        path: `${USER_EXT}/pub.seti-1.0.0/icons/seti.json`,
      },
    ]);
  });
});

describe("loadIconTheme", () => {
  it("rejects a theme that's no longer installed", async () => {
    fake({});
    await expect(m.loadIconTheme("pub.gone/gone")).rejects.toThrow("not found");
  });

  it("loads fonts and resolves glyphs and images", async () => {
    fake(SETI);
    const added: unknown[] = [];
    URL.createObjectURL = () => "blob:font";
    vi.stubGlobal(
      "FontFace",
      class {
        constructor(
          public family: string,
          public source: string,
        ) {}
        load = async () => this;
      },
    );
    Object.defineProperty(document, "fonts", {
      value: { add: (f: unknown) => added.push(f) },
      configurable: true,
    });

    const theme = await m.loadIconTheme("pub.seti/seti");
    expect(added).toEqual([
      expect.objectContaining({ source: "url(blob:font)" }),
    ]);
    expect(m.themedIcon(theme, "a.ts", "file", false)).toEqual({
      glyph: "",
      family: "icon-theme-pub-seti-seti-f",
      size: "150%",
      color: "#519aba",
    });
    expect(m.themedIcon(theme, "README.md", "file", false)).toEqual({
      image: `${USER_EXT}/pub.seti-1.0.0/icons/md.svg`,
    });
    expect(m.themedIcon(theme, "a.xyz", "file", false)).toBeNull();
    vi.unstubAllGlobals();
  });

  it("still loads a theme whose font fails, warning about it", async () => {
    fake(SETI);
    URL.createObjectURL = () => "blob:font";
    vi.stubGlobal(
      "FontFace",
      class {
        load = () => Promise.reject(new Error("bad font"));
      },
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const theme = await m.loadIconTheme("pub.seti/seti");
    expect(warn).toHaveBeenCalled();
    expect(m.themedIcon(theme, "a.ts", "file", false)).toMatchObject({
      glyph: "\uE001",
    });
    warn.mockRestore();
    vi.unstubAllGlobals();
  });
});

describe("iconUrl", () => {
  it("reads each file once, as a typed blob", async () => {
    const { calls } = fake(SETI);
    const created: Blob[] = [];
    URL.createObjectURL = (b: Blob) => (created.push(b), "blob:x");
    const path = `${USER_EXT}/pub.seti-1.0.0/icons/md.svg`;
    expect(await m.iconUrl(path)).toBe("blob:x");
    expect(await m.iconUrl(path)).toBe("blob:x");
    expect(calls.filter((c) => c === "plugin:fs|read_file")).toHaveLength(1);
    expect(created[0].type).toBe("image/svg+xml");
  });
});

describe("iconUrlNow", () => {
  it("has a read icon's URL at once", async () => {
    fake({ "/x/a.svg": "<svg/>" });
    URL.createObjectURL = () => "blob:a";
    expect(m.iconUrlNow("/x/a.svg")).toBeUndefined();
    await m.iconUrl("/x/a.svg");
    expect(m.iconUrlNow("/x/a.svg")).toBe("blob:a");
  });

  it("tries a failed read again", async () => {
    const tree: Record<string, string> = {};
    fake(tree);
    URL.createObjectURL = () => "blob:b";
    await expect(m.iconUrl("/x/b.svg")).rejects.toThrow();
    tree["/x/b.svg"] = "<svg/>";
    expect(await m.iconUrl("/x/b.svg")).toBe("blob:b");
  });
});
