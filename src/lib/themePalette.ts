import { bundledThemes, type ThemeRegistrationAny } from "shiki";
import { resolveTheme } from "./codeThemeLoad";
import type { CodeThemes, ThemeKind } from "./codeThemes";

type ThemeData = {
  colors?: Record<string, string>;
  tokenColors?: unknown;
  settings?: unknown;
};
type TokenRule = {
  scope?: string | string[];
  settings?: { foreground?: string };
};

const ROLES = ["code", "success", "warning", "destructive"] as const;
type Role = (typeof ROLES)[number];

/** The app's accent colours a theme sets; index.css keeps its own for the rest. */
export type Palette = Partial<Record<Role, string>>;

// Editor color keys per role, first found wins.
const COLOR_KEYS: Record<Exclude<Role, "code">, string[]> = {
  success: ["terminal.ansiGreen", "gitDecoration.addedResourceForeground"],
  warning: ["terminal.ansiYellow", "editorWarning.foreground"],
  destructive: [
    "editorError.foreground",
    "terminal.ansiRed",
    "errorForeground",
  ],
};

function scopeColor(theme: ThemeData, scope: string) {
  const rules = theme.tokenColors ?? theme.settings;
  if (!Array.isArray(rules)) return undefined;
  const rule = (rules as TokenRule[]).find((r) =>
    [r.scope ?? []].flat().some((s) => s.trim() === scope),
  );
  return rule?.settings?.foreground;
}

/** The palette a theme's colors and token colors give: strings tint inline code. */
export function paletteOf(theme: ThemeData): Palette {
  const palette: Palette = {};
  const code = scopeColor(theme, "string") ?? scopeColor(theme, "keyword");
  if (code) palette.code = code;
  for (const [role, keys] of Object.entries(COLOR_KEYS)) {
    const color = keys.map((k) => theme.colors?.[k]).find(Boolean);
    if (color) palette[role as Role] = color;
  }
  return palette;
}

async function themeData(id: string, kind: ThemeKind): Promise<ThemeData> {
  const theme: ThemeRegistrationAny | string = await resolveTheme(id, kind);
  if (typeof theme !== "string") return theme as ThemeData;
  const load = bundledThemes[theme as keyof typeof bundledThemes];
  return load ? ((await load()).default as ThemeData) : {};
}

/** Both themes' palettes; an unreadable one is empty. */
export async function loadPalettes(
  themes: CodeThemes,
): Promise<Record<ThemeKind, Palette>> {
  const [light, dark] = await Promise.all(
    (["light", "dark"] as const).map((kind) =>
      themeData(themes[kind], kind)
        .then(paletteOf)
        .catch(() => ({})),
    ),
  );
  return { light, dark };
}

/** Sets `--theme-<role>-<kind>` on `root`, removing the ones a theme doesn't set. */
export function applyPalettes(
  palettes: Record<ThemeKind, Palette>,
  root: HTMLElement = document.documentElement,
) {
  for (const kind of ["light", "dark"] as const) {
    for (const role of ROLES) {
      const name = `--theme-${role}-${kind}`;
      const color = palettes[kind][role];
      if (color) root.style.setProperty(name, color);
      else root.style.removeProperty(name);
    }
  }
}
