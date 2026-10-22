import {
  bundledLanguages,
  codeToHtml,
  codeToTokens,
  type BundledLanguage,
} from "shiki";
import type { CodeThemes } from "./codeThemes";
import { resolveTheme } from "./codeThemeLoad";
import { basename } from "./paths";

// Beyond this, highlighting gets slow enough to notice; show plain text instead.
const MAX_HIGHLIGHT_CHARS = 300_000;

/** A highlighted run of text; `style` sets --shiki-light / --shiki-dark. */
export type Token = { content: string; style: Record<string, string> };

async function options(code: string, path: string, themes: CodeThemes) {
  const name = basename(path).toLowerCase();
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : name;
  const lang: BundledLanguage | "text" =
    ext in bundledLanguages && code.length <= MAX_HIGHLIGHT_CHARS
      ? (ext as BundledLanguage)
      : "text";
  const [light, dark] = await Promise.all([
    resolveTheme(themes.light, "light"),
    resolveTheme(themes.dark, "dark"),
  ]);
  return { lang, themes: { light, dark }, defaultColor: false as const };
}

const recent = new Map<string, string>();
const RECENT_MAX = 200;
const recentKey = (code: string, path: string, themes: CodeThemes) =>
  `${themes.light}\0${themes.dark}\0${path}\0${code}`;

/** The last `highlight` result for these arguments, if still kept, so a remounted view starts highlighted. */
export function lastHighlight(code: string, path: string, themes: CodeThemes) {
  return recent.get(recentKey(code, path, themes)) ?? null;
}

/**
 * Highlights `code` with Shiki in both themes at once. Colours come out as
 * CSS variables (--shiki-light / --shiki-dark) that index.css switches on
 * `.dark`, so changing appearance needs no re-highlight.
 */
export async function highlight(
  code: string,
  path: string,
  themes: CodeThemes,
) {
  const html = await codeToHtml(code, await options(code, path, themes));
  const key = recentKey(code, path, themes);
  recent.delete(key);
  recent.set(key, html);
  if (recent.size > RECENT_MAX) recent.delete(recent.keys().next().value!);
  return html;
}

/** Like `highlight`, but as tokens per line, for views that lay out lines themselves. */
export async function highlightLines(
  code: string,
  path: string,
  themes: CodeThemes,
): Promise<Token[][]> {
  const { tokens } = await codeToTokens(
    code,
    await options(code, path, themes),
  );
  return tokens.map((line) =>
    line.map((t) => ({
      content: t.content,
      style: (t.htmlStyle ?? {}) as Record<string, string>,
    })),
  );
}
