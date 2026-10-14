/** The app's own Lucide glyphs, the default `icon_theme`. */
export const MINIMAL_ICONS = "minimal";

/** One icon of a VS Code file icon theme: an image file, or a glyph of one of its fonts. */
export type IconDefinition = {
  iconPath?: string;
  fontCharacter?: string;
  fontColor?: string;
  fontId?: string;
  fontSize?: string;
};

type Associations = {
  file?: string;
  folder?: string;
  folderExpanded?: string;
  fileNames?: Record<string, string>;
  fileExtensions?: Record<string, string>;
  folderNames?: Record<string, string>;
  folderNamesExpanded?: Record<string, string>;
  languageIds?: Record<string, string>;
};

/** A VS Code file icon theme's JSON (its `contributes.iconThemes` path). */
export type IconThemeFile = Associations & {
  iconDefinitions: Record<string, IconDefinition>;
  fonts?: {
    id: string;
    src: { path: string; format?: string }[];
    size?: string;
  }[];
  light?: Associations;
};

// VS Code matches these by language, which it knows from the extension or name.
const LANGUAGES: Record<string, string> = {
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "typescriptreact",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascriptreact",
  json: "json",
  jsonc: "jsonc",
  json5: "json5",
  md: "markdown",
  mdx: "mdx",
  css: "css",
  scss: "scss",
  sass: "sass",
  less: "less",
  html: "html",
  htm: "html",
  xml: "xml",
  svg: "xml",
  yml: "yaml",
  yaml: "yaml",
  toml: "toml",
  py: "python",
  rs: "rust",
  go: "go",
  rb: "ruby",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  c: "c",
  h: "c",
  cpp: "cpp",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  lua: "lua",
  sh: "shellscript",
  bash: "shellscript",
  zsh: "shellscript",
  sql: "sql",
  vue: "vue",
  svelte: "svelte",
  dart: "dart",
  txt: "plaintext",
  ini: "ini",
  bat: "bat",
  ps1: "powershell",
  gd: "gdscript",
};

const LANGUAGE_NAMES: Record<string, string> = {
  dockerfile: "dockerfile",
  makefile: "makefile",
  ".gitignore": "ignore",
  ".env": "dotenv",
};

const lowerKeys = (map?: Record<string, string>) =>
  map &&
  Object.fromEntries(Object.entries(map).map(([k, v]) => [k.toLowerCase(), v]));

/** The theme with its name and extension keys lowercased, as lookups expect. */
export function normalizeTheme(theme: IconThemeFile): IconThemeFile {
  const fix = <T extends Associations>(a: T): T => ({
    ...a,
    fileNames: lowerKeys(a.fileNames),
    fileExtensions: lowerKeys(a.fileExtensions),
    folderNames: lowerKeys(a.folderNames),
    folderNamesExpanded: lowerKeys(a.folderNamesExpanded),
  });
  return { ...fix(theme), light: theme.light && fix(theme.light) };
}

/** "a.d.ts" → ["d.ts", "ts"]: longest first, as VS Code tries them. */
function extensions(name: string) {
  const parts = name.split(".").slice(1);
  return parts.map((_, i) => parts.slice(i).join("."));
}

const first = (maps: Associations[], pick: (a: Associations) => unknown) => {
  for (const map of maps) {
    const id = pick(map);
    if (typeof id === "string") return id;
  }
};

function folderIconId(maps: Associations[], name: string, open: boolean) {
  return (
    (open && first(maps, (a) => a.folderNamesExpanded?.[name])) ||
    first(maps, (a) => a.folderNames?.[name]) ||
    (open && first(maps, (a) => a.folderExpanded)) ||
    first(maps, (a) => a.folder)
  );
}

function fileIconId(maps: Associations[], name: string) {
  const exts = extensions(name);
  const language =
    LANGUAGE_NAMES[name] ?? (exts.length ? LANGUAGES[exts.at(-1)!] : undefined);
  return (
    first(maps, (a) => a.fileNames?.[name]) ||
    exts.map((e) => first(maps, (a) => a.fileExtensions?.[e])).find(Boolean) ||
    (language && first(maps, (a) => a.languageIds?.[language])) ||
    first(maps, (a) => a.file)
  );
}

/** A file's or folder's icon id, in VS Code's order (name, extension, language, default), `light` first. */
export function iconIdFor(
  theme: IconThemeFile,
  name: string,
  kind: "file" | "folder" | "openFolder",
  light: boolean,
): string | undefined {
  const maps = light && theme.light ? [theme.light, theme] : [theme];
  const lower = name.toLowerCase();
  return kind === "file"
    ? fileIconId(maps, lower)
    : folderIconId(maps, lower, kind === "openFolder") || undefined;
}

/** A definition's `fontCharacter` ("\\E001" in the JSON) as the character itself. */
export function glyph(fontCharacter: string) {
  const hex = /^\\([0-9a-f]+)$/i.exec(fontCharacter);
  return hex ? String.fromCodePoint(parseInt(hex[1], 16)) : fontCharacter;
}
