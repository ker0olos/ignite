import { toImage } from "@/lib/images";

const STYLESHEET = /https:\/\/fonts\.googleapis\.com\/[^"'\s>]+/g;
const FONT_FILE = /https:\/\/fonts\.gstatic\.com\/[^)\s"']+/g;

async function dataUrl(url: string) {
  const response = await fetch(url);
  const type = response.headers.get("content-type") ?? "font/woff2";
  const { data } = toImage(new Uint8Array(await response.arrayBuffer()), type);
  return `data:${type};base64,${data}`;
}

async function inlined(href: string) {
  let css = await (await fetch(href)).text();
  const files = [...new Set(css.match(FONT_FILE) ?? [])];
  const urls = await Promise.all(files.map(dataUrl));
  files.forEach((file, i) => (css = css.split(file).join(urls[i])));
  return css;
}

/** The Google Fonts a page links, with their files inlined, for its capture; a font that fails is left out. */
export async function googleFontCss(html: string): Promise<string> {
  const hrefs = new Set(
    (html.match(STYLESHEET) ?? []).map((href) => href.replaceAll("&amp;", "&")),
  );
  const sheets = await Promise.all(
    [...hrefs].map((href) => inlined(href).catch(() => "")),
  );
  return sheets.join("\n");
}
