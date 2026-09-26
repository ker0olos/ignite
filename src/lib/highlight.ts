import { bundledLanguages, codeToHtml } from "shiki";
import { basename } from "./paths";

// Beyond this, highlighting gets slow enough to notice; show plain text instead.
const MAX_HIGHLIGHT_CHARS = 300_000;

/**
 * Highlights `code` with Shiki using both GitHub themes. Colours come out as
 * CSS variables (--shiki-light / --shiki-dark) that index.css switches on `.dark`.
 */
export function highlight(code: string, path: string) {
  const name = basename(path).toLowerCase();
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : name;
  const lang =
    ext in bundledLanguages && code.length <= MAX_HIGHLIGHT_CHARS
      ? ext
      : "text";
  return codeToHtml(code, {
    lang,
    themes: { light: "github-light", dark: "github-dark" },
    defaultColor: false,
  });
}
