import { homeDir } from "@tauri-apps/api/path";
import { readDir, readTextFile } from "@tauri-apps/plugin-fs";
import { parse as parseJsonc } from "jsonc-parser";
import { APP_NAME } from "./app";
import { BUILT_IN_THEMES, type CodeTheme } from "./codeThemes";
import { basename } from "./paths";

/** Key written into copied theme files, pointing back at the editor theme. */
export const IMPORTED_FROM = "importedFrom";

const EDITORS = ["Visual Studio Code", "VSCodium", "Cursor", "Windsurf"];

/** Where VS Code-family editors keep extensions: per user, and inside each app. */
export function extensionRoots(home: string) {
  return [
    `${home}/.vscode/extensions`,
    `${home}/.vscode-oss/extensions`,
    `${home}/.cursor/extensions`,
    `${home}/.windsurf/extensions`,
    ...EDITORS.map(
      (app) => `/Applications/${app}.app/Contents/Resources/app/extensions`,
    ),
  ];
}

/** Folder for theme files the user adds by hand, relative to home. */
export const CUSTOM_THEMES_DIR = `.${APP_NAME}/themes`;

/** VS Code's JSON flavour: comments and trailing commas allowed. */
export async function readJsonc<T>(path: string): Promise<T> {
  const value = parseJsonc(await readTextFile(path), [], {
    allowTrailingComma: true,
  });
  if (value == null || typeof value !== "object") {
    throw new Error(`not a JSON object: ${path}`);
  }
  return value as T;
}

/** Resolves a theme file's relative path (e.g. an `include`) against its folder. */
export const join = (dir: string, rel: string) =>
  `${dir}/${rel.replace(/^\.\//, "")}`;

type ExtensionManifest = {
  name?: string;
  publisher?: string;
  contributes?: {
    themes?: { id?: string; label: string; uiTheme: string; path: string }[];
  };
};

/** Themes contributed by one extension, with localized labels resolved. */
async function themesInExtension(dir: string): Promise<CodeTheme[]> {
  const manifest = await readJsonc<ExtensionManifest>(`${dir}/package.json`);
  const contributed = manifest.contributes?.themes ?? [];
  if (!contributed.length) return [];

  // Built-in extensions label themes "%key%", translated in package.nls.json.
  const nls = await readJsonc<Record<string, unknown>>(
    `${dir}/package.nls.json`,
  ).catch(() => ({}) as Record<string, unknown>);
  const translate = (label: string) =>
    label.replace(/^%(.+)%$/, (key, name: string) => {
      const value = nls[name];
      if (typeof value === "string") return value;
      const message = (value as { message?: unknown } | undefined)?.message;
      return typeof message === "string" ? message : key;
    });

  // Ids leave out the version so a saved choice survives extension updates.
  const extension = `${manifest.publisher ?? "vscode"}.${manifest.name ?? basename(dir)}`;
  return contributed.map((t) => ({
    id: `vscode:${extension}/${t.id ?? t.label}`,
    label: translate(t.label),
    kind: t.uiTheme === "vs" || t.uiTheme === "hc-light" ? "light" : "dark",
    source: "VS Code",
    path: join(dir, t.path),
  }));
}

async function discoverVsCode(home: string) {
  const perRoot = await Promise.all(
    extensionRoots(home).map(async (root) => {
      const entries = await readDir(root).catch(() => []);
      const perExtension = await Promise.all(
        entries
          .filter((e) => e.isDirectory)
          .map((e) => themesInExtension(`${root}/${e.name}`).catch(() => [])),
      );
      return perExtension.flat();
    }),
  );
  return perRoot.flat();
}

async function discoverCustom(home: string): Promise<CodeTheme[]> {
  const dir = `${home}/${CUSTOM_THEMES_DIR}`;
  const entries = await readDir(dir).catch(() => []);
  const themes = await Promise.all(
    entries
      .filter((e) => !e.isDirectory && e.name.endsWith(".json"))
      .map(async (e): Promise<CodeTheme | null> => {
        const path = `${dir}/${e.name}`;
        try {
          const theme = await readJsonc<Record<string, unknown>>(path);
          const importedFrom = theme[IMPORTED_FROM];
          return {
            id: `custom:${e.name}`,
            label:
              typeof theme.name === "string"
                ? theme.name
                : e.name.replace(/\.json$/, ""),
            kind: theme.type === "light" ? "light" : "dark",
            source: "Custom",
            path,
            ...(typeof importedFrom === "string" && { importedFrom }),
          };
        } catch {
          return null;
        }
      }),
  );
  return themes.filter((t) => t !== null);
}

let discovered: Promise<CodeTheme[]> | null = null;

/**
 * Every theme on offer: built-in, installed in a VS Code-family editor, and
 * custom files. The same extension installed in two editors is listed once,
 * and an editor theme already copied in is listed only as its copy.
 * Cached for the session; pass `refresh` to rescan the disk.
 */
export function listThemes(refresh = false) {
  if (!discovered || refresh) {
    discovered = homeDir().then(async (home) => {
      const [vscode, custom] = await Promise.all([
        discoverVsCode(home),
        discoverCustom(home),
      ]);
      const copied = new Set(custom.map((t) => t.importedFrom));
      const byId = new Map<string, CodeTheme>();
      for (const t of [...BUILT_IN_THEMES, ...vscode, ...custom]) {
        if (!byId.has(t.id) && !copied.has(t.id)) byId.set(t.id, t);
      }
      return [...byId.values()];
    });
  }
  return discovered;
}

/** Forces the next `listThemes` call to rescan the disk. */
export function invalidateThemes() {
  discovered = null;
}

/** File name for a copied editor theme: stable per theme, safe on disk. */
export function importedFileName(id: string) {
  const slug = id
    .replace(/^vscode:/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "theme"}.json`;
}
