import { homeDir } from "@tauri-apps/api/path";
import { readDir, readFile } from "@tauri-apps/plugin-fs";
import { APP_NAME } from "./app";
import {
  extensionRoots,
  join,
  labelTranslator,
  readJsonc,
} from "./codeThemeDiscovery";
import {
  glyph,
  iconIdFor,
  normalizeTheme,
  type IconDefinition,
  type IconThemeFile,
} from "./iconResolve";
import { basename, dirname } from "./paths";

/** Folder of VS Code icon theme extensions the user adds by hand, relative to home. */
export const CUSTOM_ICON_THEMES_DIR = `.${APP_NAME}/icon-themes`;

export type IconThemeInfo = {
  id: string;
  label: string;
  source: "Built-in" | "VS Code" | "Custom";
  path: string;
};

type ExtensionManifest = {
  name?: string;
  publisher?: string;
  contributes?: {
    iconThemes?: { id: string; label: string; path: string }[];
  };
};

async function iconThemesIn(
  dir: string,
  source: IconThemeInfo["source"],
): Promise<IconThemeInfo[]> {
  const manifest = await readJsonc<ExtensionManifest>(`${dir}/package.json`);
  const contributed = manifest.contributes?.iconThemes ?? [];
  if (!contributed.length) return [];
  const translate = await labelTranslator(dir);
  // Ids leave out the version so a saved choice survives extension updates.
  const extension = `${manifest.publisher ?? "vscode"}.${manifest.name ?? basename(dir)}`;
  return contributed.map((t) => ({
    id: `${extension}/${t.id}`,
    label: translate(t.label),
    source,
    path: join(dir, t.path),
  }));
}

async function scan(root: string, source: IconThemeInfo["source"]) {
  const entries = await readDir(root).catch(() => []);
  const found = await Promise.all(
    entries
      .filter((e) => e.isDirectory)
      .map((e) => iconThemesIn(`${root}/${e.name}`, source).catch(() => [])),
  );
  return found.flat();
}

let discovered: Promise<IconThemeInfo[]> | null = null;

/** Editor-installed and custom icon themes, each once; cached unless `refresh`. */
export function listIconThemes(refresh = false) {
  if (!discovered || refresh) {
    discovered = homeDir().then(async (home) => {
      const found = await Promise.all([
        scan(`${home}/${CUSTOM_ICON_THEMES_DIR}`, "Custom"),
        ...extensionRoots(home).map((root) => scan(root, "VS Code")),
      ]);
      const byId = new Map<string, IconThemeInfo>();
      for (const t of found.flat()) if (!byId.has(t.id)) byId.set(t.id, t);
      return [...byId.values()];
    });
  }
  return discovered;
}

/** A loaded icon theme: its lookups, where its files are, its fonts' families. */
export type IconTheme = {
  file: IconThemeFile;
  dir: string;
  fonts: Map<string, { family: string; size?: string }>;
};

async function loadFonts(id: string, file: IconThemeFile, dir: string) {
  const fonts: IconTheme["fonts"] = new Map();
  for (const font of file.fonts ?? []) {
    const src = font.src[0]?.path;
    if (!src) continue;
    const family = `icon-theme-${id}-${font.id}`.replace(/[^\w-]/g, "-");
    try {
      const url = await iconUrl(resolve(dir, src));
      document.fonts.add(await new FontFace(family, `url(${url})`).load());
    } catch (e) {
      // The theme still loads; its glyphs show in a fallback font.
      console.warn(`icon theme font ${font.id} failed to load`, e);
    }
    fonts.set(font.id, { family, size: font.size });
  }
  return fonts;
}

/** Loads an icon theme by id; rejects when it's no longer installed. */
export async function loadIconTheme(id: string): Promise<IconTheme> {
  const info = (await listIconThemes()).find((t) => t.id === id);
  if (!info) throw new Error(`icon theme not found: ${id}`);
  const file = normalizeTheme(await readJsonc<IconThemeFile>(info.path));
  const dir = dirname(info.path);
  return { file, dir, fonts: await loadFonts(id, file, dir) };
}

/** `rel` against `dir` with `.` and `..` folded away (Material's icons are `./../icons/x.svg`). */
function resolve(dir: string, rel: string) {
  const parts: string[] = [];
  for (const part of `${dir}/${rel}`.split("/")) {
    if (part === "..") parts.pop();
    else if (part !== ".") parts.push(part);
  }
  return parts.join("/");
}

const MIME: Record<string, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  webp: "image/webp",
};

const urls = new Map<string, Promise<string>>();
const ready = new Map<string, string>();

/** An icon file's URL if it's at hand now: one already read. */
export function iconUrlNow(path: string) {
  return ready.get(path);
}

/** An icon file as an object URL, read once per path (a failed read is tried again next time). */
export function iconUrl(path: string) {
  const now = iconUrlNow(path);
  if (now) return Promise.resolve(now);
  let url = urls.get(path);
  if (!url) {
    const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
    url = readFile(path).then(
      (bytes) => {
        const u = URL.createObjectURL(new Blob([bytes], { type: MIME[ext] }));
        ready.set(path, u);
        return u;
      },
      (e: unknown) => {
        urls.delete(path);
        throw e;
      },
    );
    urls.set(path, url);
  }
  return url;
}

/** How a theme draws one file or folder: an image file, a font glyph, or nothing it defines. */
export type ThemedIcon =
  | { image: string }
  | { glyph: string; family?: string; size?: string; color?: string }
  | null;

/** The theme's icon for a file or folder, if it has one. */
export function themedIcon(
  theme: IconTheme,
  name: string,
  kind: "file" | "folder" | "openFolder",
  light: boolean,
): ThemedIcon {
  const id = iconIdFor(theme.file, name, kind, light);
  const icon = id ? theme.file.iconDefinitions[id] : undefined;
  if (icon?.iconPath) return { image: resolve(theme.dir, icon.iconPath) };
  return icon?.fontCharacter ? fontIcon(theme, icon, icon.fontCharacter) : null;
}

function fontIcon(theme: IconTheme, icon: IconDefinition, char: string) {
  const font = theme.fonts.get(icon.fontId ?? theme.file.fonts?.[0]?.id ?? "");
  return {
    glyph: glyph(char),
    family: font?.family,
    size: icon.fontSize ?? font?.size,
    color: icon.fontColor,
  };
}
