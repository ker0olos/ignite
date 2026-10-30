import {
  bundledLanguages,
  codeToHtml,
  codeToTokens,
  type BundledLanguage,
  type ThemedToken,
} from "shiki";
import type { CodeThemes } from "./codeThemes";
import type { DiffLine } from "./toolRows";
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

// Each hunk's old side (only when it removes lines) then its new side, so context takes the new side's tokens.
function sides(lines: DiffLine[]) {
  const runs: number[][] = [];
  let hunk: number[] = [];
  const flush = () => {
    if (hunk.some((i) => lines[i].kind === "del"))
      runs.push(hunk.filter((i) => lines[i].kind !== "add"));
    if (hunk.length) runs.push(hunk.filter((i) => lines[i].kind !== "del"));
    hunk = [];
  };
  lines.forEach((l, i) => (l.kind === "gap" ? flush() : hunk.push(i)));
  flush();
  return runs;
}

/** Tokens per diff line, each hunk's old and new side highlighted on its own so no line inherits another's state. */
export async function highlightDiff(
  lines: DiffLine[],
  path: string,
  themes: CodeThemes,
): Promise<(Token[] | undefined)[]> {
  const text = (i: number) => (lines[i] as { text: string }).text;
  const all = lines.map((l) => (l.kind === "gap" ? "" : l.text)).join("\n");
  const opts = await options(all, path, themes);
  const runs = sides(lines);
  const tokens = await Promise.all(
    runs.map((rows) => codeToTokens(rows.map(text).join("\n"), opts)),
  );
  const out: (Token[] | undefined)[] = lines.map(() => undefined);
  runs.forEach((rows, r) =>
    rows.forEach((i, j) => (out[i] = tokens[r].tokens[j]?.map(toToken))),
  );
  return out;
}

function toToken(t: ThemedToken): Token {
  return {
    content: t.content,
    style: (t.htmlStyle ?? {}) as Record<string, string>,
  };
}
