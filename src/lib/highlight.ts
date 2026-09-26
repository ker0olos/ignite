import { bundledLanguages, codeToHtml } from "shiki";
import { resolveTheme, type CodeThemes } from "./codeThemes";
import { basename } from "./paths";

// Beyond this, highlighting gets slow enough to notice; show plain text instead.
const MAX_HIGHLIGHT_CHARS = 300_000;

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
  const name = basename(path).toLowerCase();
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : name;
  const lang =
    ext in bundledLanguages && code.length <= MAX_HIGHLIGHT_CHARS
      ? ext
      : "text";
  const [light, dark] = await Promise.all([
    resolveTheme(themes.light, "light"),
    resolveTheme(themes.dark, "dark"),
  ]);
  return codeToHtml(code, {
    lang,
    themes: { light, dark },
    defaultColor: false,
  });
}
