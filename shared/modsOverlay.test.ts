// @vitest-environment node
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { build, type Rolldown } from "vite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type Overlay,
  originalOf,
  overlayFromEnv,
  overrideFor,
} from "./modsOverlay.ts";
import { modsVitePlugin } from "./modsVitePlugin.ts";

let overlay: Overlay;
beforeEach(async () => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), "mods-")));
  overlay = { root: join(dir, "repo"), mods: join(dir, "mods") };
});
afterEach(() => rm(dirname(overlay.root), { recursive: true, force: true }));

async function put(path: string, text = "") {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
}

describe("overlayFromEnv", () => {
  it("is off unless IGNITION_MODS is set", () => {
    vi.stubEnv("IGNITION_MODS", "");
    expect(overlayFromEnv("/repo")).toBeNull();
    vi.stubEnv("IGNITION_MODS", "/mods");
    expect(overlayFromEnv("/repo")).toEqual({ root: "/repo", mods: "/mods" });
    vi.unstubAllEnvs();
  });
});

describe("overrideFor", () => {
  it("finds the mods/ twin of a repo file", async () => {
    await put(join(overlay.mods, "src/a.ts"));
    expect(overrideFor(overlay, join(overlay.root, "src/a.ts"))).toBe(
      join(overlay.mods, "src/a.ts"),
    );
  });

  it("is null when mods/ has no twin", () => {
    expect(overrideFor(overlay, join(overlay.root, "src/a.ts"))).toBeNull();
  });

  it("never overrides config, dependencies or files outside the repo", async () => {
    await put(join(overlay.mods, "vite.config.ts"));
    await put(join(overlay.mods, "node_modules/x/index.js"));
    expect(
      overrideFor(overlay, join(overlay.root, "vite.config.ts")),
    ).toBeNull();
    expect(
      overrideFor(overlay, join(overlay.root, "node_modules/x/index.js")),
    ).toBeNull();
    expect(overrideFor(overlay, "/elsewhere/src/a.ts")).toBeNull();
    expect(overrideFor(overlay, overlay.root)).toBeNull();
  });
});

describe("originalOf", () => {
  it("maps a mods/ file back to the repo, and anything else to null", () => {
    expect(originalOf(overlay, join(overlay.mods, "src/a.ts"))).toBe(
      join(overlay.root, "src/a.ts"),
    );
    expect(originalOf(overlay, join(overlay.root, "src/a.ts"))).toBeNull();
  });
});

describe("modsVitePlugin", () => {
  async function bundle(entry: string): Promise<string> {
    const result = (await build({
      root: overlay.root,
      logLevel: "silent",
      configFile: false,
      plugins: [modsVitePlugin(overlay)],
      build: {
        write: false,
        minify: false,
        lib: { entry, formats: ["es"] },
      },
    })) as Rolldown.RolldownOutput[];
    return result[0].output.map((o) => ("code" in o ? o.code : "")).join("");
  }

  it("bundles mods/ files, resolving their imports from the original's folder", async () => {
    await put(
      join(overlay.root, "src/main.ts"),
      'import { name } from "./name.ts"; console.log(name);',
    );
    await put(join(overlay.root, "src/name.ts"), 'export const name = "repo";');
    await put(
      join(overlay.root, "src/shout.ts"),
      "export const shout = (s: string) => s + '!';",
    );
    await put(
      join(overlay.mods, "src/name.ts"),
      'import { shout } from "./shout.ts"; import { extra } from "./extra.ts";\n' +
        'export const name = shout("modded" + extra);',
    );
    await put(
      join(overlay.mods, "src/extra.ts"),
      'export const extra = "-extra";',
    );
    const code = await bundle(join(overlay.root, "src/main.ts"));
    expect(code).toContain('shout("modded-extra")');
    expect(code).toContain('s + "!"');
    expect(code).not.toContain('"repo"');
  });

  it("points Tailwind at mods/ from the main stylesheet only", () => {
    const { transform } = modsVitePlugin(overlay) as {
      transform: (code: string, id: string) => string | null;
    };
    expect(transform("a{}", "/repo/src/index.css?direct")).toBe(
      `a{}\n@source ${JSON.stringify(overlay.mods)};\n`,
    );
    expect(transform("a{}", "/repo/src/other.css")).toBeNull();
  });

  it("restarts the dev server when a mods/ file is added or deleted", () => {
    const handlers: Record<string, (file: string) => void> = {};
    const server = {
      restart: vi.fn(async () => {}),
      watcher: {
        add: vi.fn(),
        on: (event: string, cb: (file: string) => void) =>
          void (handlers[event] = cb),
      },
    };
    const { configureServer } = modsVitePlugin(overlay) as unknown as {
      configureServer: (s: typeof server) => void;
    };
    configureServer(server);
    expect(server.watcher.add).toHaveBeenCalledWith(overlay.mods);
    handlers.add(join(overlay.root, "src/a.ts"));
    expect(server.restart).not.toHaveBeenCalled();
    handlers.add(join(overlay.mods, "src/a.ts"));
    handlers.unlink(join(overlay.mods, "src/a.ts"));
    expect(server.restart).toHaveBeenCalledTimes(2);
  });
});
